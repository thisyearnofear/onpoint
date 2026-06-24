"""
TinyFish client for OnPoint Agent Web-Bridge.

Provides Search + Fetch (fast structured extraction) and Agent (deep browsing)
via a single interface that returns the same ItemData shape used by the rest of
the bridge.

Anti-bot posture is delegated to the caller (the worker in apps/api decides per
merchant which `browser_profile` and `proxy_country` to send). The client just
plumbs the values through.
"""

import asyncio
import os
import re
import logging
from dataclasses import dataclass, field
from typing import AsyncGenerator, List, Literal, Optional

import httpx

logger = logging.getLogger("bridge.tinyfish")

SEARCH_URL = "https://api.search.tinyfish.ai"
FETCH_URL = "https://api.fetch.tinyfish.ai"
RUN_ASYNC_URL = "https://agent.tinyfish.ai/v1/automation/run-async"
RUN_POLL_URL = "https://agent.tinyfish.ai/v1/runs"

# Fashion domains to prioritise in search results
FASHION_DOMAINS = {
    "farfetch.com", "ssense.com", "zara.com", "asos.com",
    "hm.com", "nordstrom.com", "net-a-porter.com",
}

# Polling cadence for run-async
POLL_INTERVAL_MS = 1500
DEFAULT_MAX_WAIT_MS = 180_000

# Anti-bot posture options — passed straight through to TinyFish
BrowserProfile = Literal["LITE", "STEALTH"]
ProxyCountry = Literal["US", "GB", "CA", "DE", "FR", "JP", "AU"]

TERMINAL_STATUSES = {"COMPLETED", "FAILED", "CANCELLED"}


@dataclass
class TinyFishProduct:
    name: str
    price: float
    source: str
    url: str
    image_url: Optional[str] = None
    currency: str = "USD"


@dataclass
class TinyFishAgentUpdate:
    """One phase of an async agent run, yielded to streaming consumers."""
    phase: Literal["starting", "running", "done", "error"]
    run_id: Optional[str] = None
    streaming_url: Optional[str] = None
    status: Optional[str] = None
    result: Optional[dict] = None
    error: Optional[str] = None
    # Anti-bot posture applied for this run (echoed so the UI can label it).
    browser_profile: BrowserProfile = "LITE"
    proxy_country: Optional[ProxyCountry] = None
    used_profile: bool = False
    profile_id: Optional[str] = None


@dataclass
class TinyFishResult:
    products: List[TinyFishProduct] = field(default_factory=list)
    live_url: Optional[str] = None
    run_id: Optional[str] = None
    streaming_url: Optional[str] = None
    # Anti-bot fields populated when the run completes (used by caller to
    # decide whether to escalate next run).
    browser_profile: BrowserProfile = "LITE"
    proxy_country: Optional[str] = None
    blocked: bool = False  # True if the agent returned a "blocked" sentinel
    # Carries the last update yielded by the async poll loop, so non-streaming
    # callers (search_and_fetch's JSON path) can inspect the terminal phase.
    last_phase: Optional[str] = None


class TinyFishClient:
    """Thin wrapper around TinyFish Search / Fetch / Agent APIs.

    Public surface (preserved from the previous implementation):
      - search_and_fetch(query, max_results=3)
      - agent_browse(query, max_results=3, **anti_bot_options)
      - TinyFishResult, TinyFishProduct dataclasses

    New optional kwargs on agent_browse:
      - use_profile: bool = True         (Browser Context Profiles)
      - profile_id: Optional[str] = None
      - browser_profile: "LITE" | "STEALTH" = "LITE"
      - proxy_country: Optional[str] = None  (e.g. "US")
      - max_wait_ms: int = 180_000
      - on_update: Optional[Callable[[TinyFishAgentUpdate], None]] = None
                    Called for each phase as the run progresses. The non-
                    streaming agent_browse() signature still returns a single
                    TinyFishResult at the end.
    """

    def __init__(self, api_key: Optional[str] = None, timeout: float = 30):
        self.api_key = api_key or os.getenv("TINYFISH_API_KEY", "")
        self._client = httpx.AsyncClient(
            timeout=timeout,
            headers={"X-API-Key": self.api_key},
        )

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    async def close(self):
        await self._client.aclose()

    # ------------------------------------------------------------------
    # Search + Fetch (fast path — structured extraction, no browser)
    # ------------------------------------------------------------------

    async def search_and_fetch(
        self, query: str, max_results: int = 3
    ) -> TinyFishResult:
        """Tier 2.5: Search the web, then fetch top product pages."""
        if not self.available:
            return TinyFishResult()

        try:
            resp = await self._client.get(
                SEARCH_URL,
                params={"query": f"{query} buy online", "num_results": max_results * 2},
            )
            resp.raise_for_status()
            results = resp.json().get("results", [])

            results.sort(
                key=lambda r: any(d in r.get("url", "") for d in FASHION_DOMAINS),
                reverse=True,
            )
            urls = [r["url"] for r in results[:max_results]]

            if not urls:
                return TinyFishResult()

            resp = await self._client.post(
                FETCH_URL,
                json={"urls": urls, "format": "markdown"},
            )
            resp.raise_for_status()
            pages = resp.json().get("results", [])

            products: List[TinyFishProduct] = [
                p for p in (_extract_product(page, query) for page in pages) if p
            ]

            logger.info(f"TinyFish search+fetch: {len(products)} products for '{query}'")
            return TinyFishResult(products=products)

        except Exception as e:
            logger.error(f"TinyFish search+fetch failed: {e}")
            return TinyFishResult()

    # ------------------------------------------------------------------
    # Agent (deep path — full browser automation via /run-async + polling)
    # ------------------------------------------------------------------

    async def agent_browse(
        self,
        query: str,
        max_results: int = 3,
        *,
        use_profile: bool = True,
        profile_id: Optional[str] = None,
        browser_profile: BrowserProfile = "LITE",
        proxy_country: Optional[ProxyCountry] = None,
        max_wait_ms: int = DEFAULT_MAX_WAIT_MS,
        on_update=None,
    ) -> TinyFishResult:
        """Tier 3: Use TinyFish Agent for deep browsing.

        The async /run-async endpoint returns a run id; we poll
        /v1/runs/{id} until terminal status. The streaming_url is captured
        as soon as it appears so the UI can embed the live preview.
        """
        if not self.available:
            return TinyFishResult()

        # Resolve profile source: explicit profile_id wins; else default env var.
        effective_profile_id = profile_id or os.getenv("TINYFISH_DEFAULT_PROFILE_ID")
        use_profile_effective = bool(use_profile and self.api_key)

        goal = self._build_agent_goal(query, max_results)

        updates: List[TinyFishAgentUpdate] = []
        try:
            async for update in self._async_poll_loop(
                goal=goal,
                use_profile=use_profile_effective,
                profile_id=effective_profile_id,
                browser_profile=browser_profile,
                proxy_country=proxy_country,
                max_wait_ms=max_wait_ms,
            ):
                updates.append(update)
                if on_update is not None:
                    try:
                        on_update(update)
                    except Exception as cb_err:  # never let a bad callback kill the run
                        logger.warning(f"on_update callback raised: {cb_err}")
                if update.phase in ("done", "error"):
                    break
        except Exception as e:
            logger.error(f"TinyFish agent browse failed: {e}")
            return TinyFishResult(
                browser_profile=browser_profile,
                proxy_country=proxy_country,
                blocked=False,
                last_phase="error",
            )

        if not updates:
            return TinyFishResult(
                browser_profile=browser_profile,
                proxy_country=proxy_country,
                last_phase="error",
            )

        terminal = updates[-1]

        if terminal.phase == "error":
            return TinyFishResult(
                streaming_url=terminal.streaming_url,
                run_id=terminal.run_id,
                browser_profile=browser_profile,
                proxy_country=proxy_country,
                blocked=_looks_blocked(terminal),
                last_phase="error",
            )

        products = _products_from_agent_result(terminal.result, query)
        blocked = _looks_blocked(terminal)

        logger.info(
            f"TinyFish agent: {len(products)} products for '{query}' "
            f"(profile={browser_profile}, proxy={proxy_country or 'none'}, blocked={blocked})"
        )

        return TinyFishResult(
            products=products,
            live_url=terminal.streaming_url,
            run_id=terminal.run_id,
            streaming_url=terminal.streaming_url,
            browser_profile=browser_profile,
            proxy_country=proxy_country,
            blocked=blocked,
            last_phase="done",
        )

    async def stream_agent_browse(
        self,
        query: str,
        max_results: int = 3,
        *,
        use_profile: bool = True,
        profile_id: Optional[str] = None,
        browser_profile: BrowserProfile = "LITE",
        proxy_country: Optional[ProxyCountry] = None,
        max_wait_ms: int = DEFAULT_MAX_WAIT_MS,
    ) -> AsyncGenerator[TinyFishAgentUpdate, None]:
        """Streaming variant of agent_browse. Yields TinyFishAgentUpdate per phase.

        Useful for SSE endpoints that want to forward each phase to the UI.
        """
        if not self.available:
            yield TinyFishAgentUpdate(phase="error", error="TINYFISH_API_KEY not set")
            return

        effective_profile_id = profile_id or os.getenv("TINYFISH_DEFAULT_PROFILE_ID")
        use_profile_effective = bool(use_profile and self.api_key)
        goal = self._build_agent_goal(query, max_results)

        async for update in self._async_poll_loop(
            goal=goal,
            use_profile=use_profile_effective,
            profile_id=effective_profile_id,
            browser_profile=browser_profile,
            proxy_country=proxy_country,
            max_wait_ms=max_wait_ms,
        ):
            yield update

    # ------------------------------------------------------------------
    # Async poll loop (DRY: shared by agent_browse and stream_agent_browse)
    # ------------------------------------------------------------------

    async def _async_poll_loop(
        self,
        *,
        goal: str,
        use_profile: bool,
        profile_id: Optional[str],
        browser_profile: BrowserProfile,
        proxy_country: Optional[ProxyCountry],
        max_wait_ms: int,
    ) -> AsyncGenerator[TinyFishAgentUpdate, None]:
        # 1. Kick off the async run.
        run_id = await self._start_run(
            goal=goal,
            use_profile=use_profile,
            profile_id=profile_id,
            browser_profile=browser_profile,
            proxy_country=proxy_country,
        )

        yield TinyFishAgentUpdate(
            phase="starting",
            run_id=run_id,
            browser_profile=browser_profile,
            proxy_country=proxy_country,
            used_profile=use_profile,
            profile_id=profile_id,
        )

        # 2. Poll until terminal.
        deadline = asyncio.get_event_loop().time() + (max_wait_ms / 1000)
        announced_running = False
        streaming_url: Optional[str] = None
        poll_interval = POLL_INTERVAL_MS / 1000

        while True:
            run = await self._get_run(run_id)
            status = run.get("status") or "RUNNING"

            if run.get("streaming_url"):
                streaming_url = run["streaming_url"]

            # Surface the live preview as soon as it appears (and only once).
            if not announced_running and streaming_url:
                announced_running = True
                yield TinyFishAgentUpdate(
                    phase="running",
                    run_id=run_id,
                    streaming_url=streaming_url,
                    status=status,
                    browser_profile=browser_profile,
                    proxy_country=proxy_country,
                    used_profile=use_profile,
                    profile_id=profile_id,
                )

            if status in TERMINAL_STATUSES:
                if status == "COMPLETED":
                    yield TinyFishAgentUpdate(
                        phase="done",
                        run_id=run_id,
                        streaming_url=streaming_url,
                        status=status,
                        result=run.get("result"),
                        browser_profile=browser_profile,
                        proxy_country=proxy_country,
                        used_profile=use_profile,
                        profile_id=profile_id,
                    )
                else:
                    yield TinyFishAgentUpdate(
                        phase="error",
                        run_id=run_id,
                        streaming_url=streaming_url,
                        status=status,
                        error=(run.get("error") or {}).get("message")
                              or f"Run ended with status {status}",
                        browser_profile=browser_profile,
                        proxy_country=proxy_country,
                        used_profile=use_profile,
                        profile_id=profile_id,
                    )
                return

            if asyncio.get_event_loop().time() > deadline:
                yield TinyFishAgentUpdate(
                    phase="error",
                    run_id=run_id,
                    streaming_url=streaming_url,
                    status=status,
                    error=f"Timed out after {max_wait_ms}ms waiting for run to finish.",
                    browser_profile=browser_profile,
                    proxy_country=proxy_country,
                    used_profile=use_profile,
                    profile_id=profile_id,
                )
                return

            await asyncio.sleep(poll_interval)

    async def _start_run(
        self,
        *,
        goal: str,
        use_profile: bool,
        profile_id: Optional[str],
        browser_profile: BrowserProfile,
        proxy_country: Optional[ProxyCountry],
    ) -> str:
        body = {
            "url": "https://www.google.com",
            "goal": goal,
            "browser_profile": browser_profile,
        }
        if proxy_country:
            body["proxy_config"] = {"enabled": True, "country_code": proxy_country}
        if use_profile:
            body["use_profile"] = True
            if profile_id:
                body["profile_id"] = profile_id

        resp = await self._client.post(RUN_ASYNC_URL, json=body)
        if not resp.is_success:
            text = resp.text[:300]
            raise RuntimeError(f"TinyFish run-async failed ({resp.status_code}): {text}")

        data = resp.json()
        run_id = data.get("run_id") or data.get("id")
        if not run_id:
            raise RuntimeError("TinyFish did not return a run id.")
        return run_id

    async def _get_run(self, run_id: str) -> dict:
        resp = await self._client.get(
            f"{RUN_POLL_URL}/{run_id}",
            params={"screenshots": "none", "html": "none"},
        )
        if not resp.is_success:
            text = resp.text[:200]
            raise RuntimeError(f"TinyFish get-run failed ({resp.status_code}): {text}")
        return resp.json()

    @staticmethod
    def _build_agent_goal(query: str, max_results: int) -> str:
        """Append the anti-bot goal-hardening suffix used on every agent run.

        Centralised so callers cannot bypass it (per ADR 0008 D3).
        """
        whitelist = ", ".join(sorted(FASHION_DOMAINS))
        return (
            f"Search for fashion items matching: '{query}'. "
            f"Find up to {max_results} items, prioritising: {whitelist}. "
            "For each item return JSON with: name, price (number), currency, "
            "source (site name), url, image_url. Return a JSON array.\n\n"
            "Anti-bot instructions:\n"
            "1. Close any cookie consent or GDPR banner before doing anything else.\n"
            "2. Wait for the page to fully load before interacting with anything.\n"
            "3. Describe elements visually (e.g. 'the blue Add to Cart button'), "
            "never by CSS selector.\n"
            "4. If you see an 'Access Denied', CAPTCHA, or anti-bot challenge, "
            "stop and return { \"error\": \"blocked\" } as the array element.\n"
            "Do not click any purchase or checkout buttons."
        )


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

_PRICE_RE = re.compile(r"\$\s?([\d,]+(?:\.\d{2})?)")


def _extract_product(page: dict, query: str) -> Optional[TinyFishProduct]:
    """Best-effort product extraction from a fetched page (search_and_fetch path)."""
    title = page.get("title", "")
    text = page.get("text", "")
    url = page.get("final_url") or page.get("url", "")

    if not title:
        return None

    price_match = _PRICE_RE.search(text[:2000])
    price = float(price_match.group(1).replace(",", "")) if price_match else 0

    source = page.get("site_name", "")
    if not source and url:
        try:
            from urllib.parse import urlparse
            source = urlparse(url).netloc.replace("www.", "")
        except Exception:
            source = "web"

    return TinyFishProduct(name=title, price=price, source=source, url=url)


def _products_from_agent_result(result, query: str) -> List[TinyFishProduct]:
    """Convert TinyFish Agent's structured result into TinyFishProduct list.

    The agent path is now trusted as structured JSON (per ADR 0008 D1). The
    regex fallback is removed from this path — the agent either returns clean
    data or we treat the run as blocked.
    """
    if result is None:
        return []

    raw = result
    if isinstance(raw, str):
        import json as _json
        try:
            raw = _json.loads(raw)
        except Exception:
            logger.warning(f"TinyFish agent returned non-JSON result for '{query}'")
            return []

    if isinstance(raw, dict):
        if "error" in raw:
            return []
        items = raw.get("items") or raw.get("products") or [raw]
    elif isinstance(raw, list):
        items = raw
    else:
        return []

    products: List[TinyFishProduct] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        if item.get("error"):
            continue
        if not item.get("name"):
            continue
        try:
            price = float(item.get("price") or 0)
        except (TypeError, ValueError):
            price = 0
        products.append(
            TinyFishProduct(
                name=item.get("name", "Unknown"),
                price=price,
                source=item.get("source", "tinyfish-agent"),
                url=item.get("url", ""),
                image_url=item.get("image_url"),
                currency=item.get("currency", "USD"),
            )
        )
    return products


def _looks_blocked(update: TinyFishAgentUpdate) -> bool:
    """True if the agent returned an anti-bot sentinel (per ADR 0008 D4)."""
    if update.phase == "error":
        msg = (update.error or "").lower()
        if any(k in msg for k in ("blocked", "captcha", "access denied", "forbidden")):
            return True
    result = update.result
    if isinstance(result, dict):
        if result.get("error") == "blocked":
            return True
        if isinstance(result.get("items"), list):
            return any(
                isinstance(it, dict) and it.get("error") == "blocked"
                for it in result["items"]
            )
    if isinstance(result, list):
        return any(
            isinstance(it, dict) and it.get("error") == "blocked"
            for it in result
        )
    return False
