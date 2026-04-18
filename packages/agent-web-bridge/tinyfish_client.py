"""
TinyFish client for OnPoint Agent Web-Bridge.

Provides Search + Fetch (fast structured extraction) and Agent (deep browsing
fallback) via a single interface that returns the same ItemData shape used by
the rest of the bridge.
"""

import os
import re
import logging
from dataclasses import dataclass, field
from typing import List, Optional

import httpx

logger = logging.getLogger("bridge.tinyfish")

SEARCH_URL = "https://api.search.tinyfish.ai"
FETCH_URL = "https://api.fetch.tinyfish.ai"
AGENT_URL = "https://agent.tinyfish.ai/v1/automation/run"

# Fashion domains to prioritise in search results
FASHION_DOMAINS = {
    "farfetch.com", "ssense.com", "zara.com", "asos.com",
    "hm.com", "nordstrom.com", "net-a-porter.com",
}


@dataclass
class TinyFishProduct:
    name: str
    price: float
    source: str
    url: str
    image_url: Optional[str] = None
    currency: str = "USD"


@dataclass
class TinyFishResult:
    products: List[TinyFishProduct] = field(default_factory=list)
    live_url: Optional[str] = None


class TinyFishClient:
    """Thin wrapper around TinyFish Search / Fetch / Agent APIs."""

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
            # 1. Search
            resp = await self._client.get(
                SEARCH_URL,
                params={"query": f"{query} buy online", "num_results": max_results * 2},
            )
            resp.raise_for_status()
            results = resp.json().get("results", [])

            # Prioritise fashion domains
            results.sort(
                key=lambda r: any(d in r.get("url", "") for d in FASHION_DOMAINS),
                reverse=True,
            )
            urls = [r["url"] for r in results[:max_results]]

            if not urls:
                return TinyFishResult()

            # 2. Fetch pages for structured content
            resp = await self._client.post(
                FETCH_URL,
                json={"urls": urls, "format": "markdown"},
            )
            resp.raise_for_status()
            pages = resp.json().get("results", [])

            products: List[TinyFishProduct] = []
            for page in pages:
                product = _extract_product(page, query)
                if product:
                    products.append(product)

            logger.info(f"TinyFish search+fetch: {len(products)} products for '{query}'")
            return TinyFishResult(products=products)

        except Exception as e:
            logger.error(f"TinyFish search+fetch failed: {e}")
            return TinyFishResult()

    # ------------------------------------------------------------------
    # Agent (deep path — full browser automation, Browser Use alternative)
    # ------------------------------------------------------------------

    async def agent_browse(
        self, query: str, max_results: int = 3
    ) -> TinyFishResult:
        """Tier 3 alternative: Use TinyFish Agent for deep browsing."""
        if not self.available:
            return TinyFishResult()

        whitelist = ", ".join(FASHION_DOMAINS)
        goal = (
            f"Search for fashion items matching: '{query}'. "
            f"Find up to {max_results} items, prioritising: {whitelist}. "
            "For each item return JSON with: name, price (number), currency, "
            "source (site name), url, image_url. Return a JSON array."
        )

        try:
            resp = await self._client.post(
                AGENT_URL,
                json={"url": "https://www.google.com", "goal": goal},
            )
            resp.raise_for_status()
            data = resp.json()

            raw = data.get("result", [])
            if isinstance(raw, str):
                import json as _json
                raw = _json.loads(raw)
            if isinstance(raw, dict):
                raw = [raw]

            products = [
                TinyFishProduct(
                    name=item.get("name", "Unknown"),
                    price=float(item.get("price", 0)),
                    source=item.get("source", "tinyfish-agent"),
                    url=item.get("url", ""),
                    image_url=item.get("image_url"),
                    currency=item.get("currency", "USD"),
                )
                for item in raw
                if item.get("name")
            ]

            logger.info(f"TinyFish agent: {len(products)} products for '{query}'")
            return TinyFishResult(products=products, live_url=data.get("live_url"))

        except Exception as e:
            logger.error(f"TinyFish agent browse failed: {e}")
            return TinyFishResult()


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

_PRICE_RE = re.compile(r"\$\s?([\d,]+(?:\.\d{2})?)")


def _extract_product(page: dict, query: str) -> Optional[TinyFishProduct]:
    """Best-effort product extraction from a fetched page."""
    title = page.get("title", "")
    text = page.get("text", "")
    url = page.get("final_url") or page.get("url", "")

    if not title:
        return None

    # Extract first price from page text
    price_match = _PRICE_RE.search(text[:2000])
    price = float(price_match.group(1).replace(",", "")) if price_match else 0

    # Derive source from URL domain
    source = page.get("site_name", "")
    if not source and url:
        try:
            from urllib.parse import urlparse
            source = urlparse(url).netloc.replace("www.", "")
        except Exception:
            source = "web"

    return TinyFishProduct(name=title, price=price, source=source, url=url)
