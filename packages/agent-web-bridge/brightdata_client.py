"""
Bright Data client for OnPoint Agent Web-Bridge.

Provides structured product search via SERP API (Google Shopping) and
page extraction via Web Unlocker. Returns the same ItemData shape used
by the rest of the bridge.

Env vars:
  BRIGHTDATA_API_KEY     — Bright Data API bearer token (required)
  BRIGHTDATA_SERP_ZONE   — SERP API zone name (default: "serp_api")
  BRIGHTDATA_UNLOCKER_ZONE — Web Unlocker zone name (default: "web_unlocker")
"""

import os
import re
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional
from urllib.parse import quote_plus, urlparse

import httpx

logger = logging.getLogger("bridge.brightdata")

API_URL = "https://api.brightdata.com/request"

# Fashion domains to prioritise in search results
FASHION_DOMAINS = {
    "farfetch.com", "ssense.com", "zara.com", "asos.com",
    "hm.com", "nordstrom.com", "net-a-porter.com",
    "uniqlo.com", "mango.com", "topshop.com",
}


@dataclass
class ProductResult:
    """Unified product result — matches ProductResult in @onpoint/shared-types."""
    name: str
    price: float
    source: str
    url: str
    image_url: Optional[str] = None
    currency: str = "USD"


@dataclass
class MarketSignal:
    """Retail intelligence signal derived from live web evidence."""
    id: str
    type: str
    query: str
    source: str
    title: str
    evidence: str
    action: str
    confidence: float
    created_at: str
    url: Optional[str] = None
    price: Optional[float] = None
    currency: str = "USD"


@dataclass
class BrightDataResult:
    products: List[ProductResult] = field(default_factory=list)
    signals: List[MarketSignal] = field(default_factory=list)
    live_url: Optional[str] = None


class BrightDataClient:
    """Thin wrapper around Bright Data SERP API + Web Unlocker."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        serp_zone: Optional[str] = None,
        unlocker_zone: Optional[str] = None,
        timeout: float = 30,
    ):
        self.api_key = api_key or os.getenv("BRIGHTDATA_API_KEY", "")
        self.serp_zone = serp_zone or os.getenv("BRIGHTDATA_SERP_ZONE", "serp_api")
        self.unlocker_zone = unlocker_zone or os.getenv("BRIGHTDATA_UNLOCKER_ZONE", "web_unlocker")
        self._client = httpx.AsyncClient(
            timeout=timeout,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    async def close(self):
        await self._client.aclose()

    # ------------------------------------------------------------------
    # SERP API — structured search (Google Shopping)
    # ------------------------------------------------------------------

    async def search_products(
        self, query: str, max_results: int = 3
    ) -> BrightDataResult:
        """Search Google Shopping for fashion products via SERP API."""
        if not self.available:
            return BrightDataResult()

        try:
            search_query = f"{query} buy online"
            encoded_query = quote_plus(search_query)

            # Google Shopping search (tbm=shop)
            shopping_url = f"https://www.google.com/search?q={encoded_query}&tbm=shop&hl=en&gl=us"

            resp = await self._client.post(
                API_URL,
                json={
                    "zone": self.serp_zone,
                    "url": shopping_url,
                    "format": "raw",
                    "data_format": "parsed_light",
                },
            )
            resp.raise_for_status()
            data = resp.json()

            products = self._parse_serp_results(data, max_results)

            if products:
                logger.info(f"BrightData SERP: {len(products)} products for '{query}'")
                return BrightDataResult(
                    products=products,
                    signals=self._derive_market_signals(query, products),
                )

            # Fallback: regular Google search
            logger.info("BrightData SERP: No Shopping results, trying regular search")
            regular_url = f"https://www.google.com/search?q={encoded_query}&hl=en&gl=us"

            resp = await self._client.post(
                API_URL,
                json={
                    "zone": self.serp_zone,
                    "url": regular_url,
                    "format": "raw",
                    "data_format": "parsed_light",
                },
            )
            resp.raise_for_status()
            data = resp.json()

            products = self._parse_organic_results(data, max_results)
            logger.info(f"BrightData SERP (organic): {len(products)} products for '{query}'")
            return BrightDataResult(
                products=products,
                signals=self._derive_market_signals(query, products),
            )

        except Exception as e:
            logger.error(f"BrightData SERP failed: {e}")
            return BrightDataResult()

    # ------------------------------------------------------------------
    # Web Unlocker — page extraction (for product detail pages)
    # ------------------------------------------------------------------

    async def fetch_product_page(self, url: str) -> Optional[ProductResult]:
        """Fetch and extract product data from a single page via Web Unlocker."""
        if not self.available:
            return None

        try:
            resp = await self._client.post(
                API_URL,
                json={
                    "zone": self.unlocker_zone,
                    "url": url,
                    "format": "raw",
                },
            )
            resp.raise_for_status()
            html = resp.text

            return self._extract_from_html(html, url)

        except Exception as e:
            logger.error(f"BrightData Web Unlocker failed for {url}: {e}")
            return None

    # ------------------------------------------------------------------
    # Parsers
    # ------------------------------------------------------------------

    def _parse_serp_results(
        self, data: dict, max_results: int
    ) -> List[ProductResult]:
        """Parse Google Shopping SERP results into products."""
        products: List[ProductResult] = []

        # Shopping results are in "shopping" or "product_results"
        shopping = data.get("shopping", data.get("product_results", []))
        if not isinstance(shopping, list):
            shopping = []

        for item in shopping[:max_results]:
            try:
                name = item.get("title", item.get("name", ""))
                if not name:
                    continue

                price = self._parse_price(
                    item.get("price", item.get("extracted_price", "0"))
                )

                url = item.get("link", item.get("url", ""))
                source = self._extract_result_source(item, url)
                image_url = item.get("thumbnail", item.get("image", ""))

                products.append(
                    ProductResult(
                        name=name,
                        price=price,
                        source=source,
                        url=url,
                        image_url=image_url,
                    )
                )
            except Exception as e:
                logger.warning(f"Skipping malformed Shopping result: {e}")
                continue

        return products

    def _parse_organic_results(
        self, data: dict, max_results: int
    ) -> List[ProductResult]:
        """Parse organic Google search results, filtering for product-like pages."""
        products: List[ProductResult] = []

        organic = data.get("organic", [])
        if not isinstance(organic, list):
            return products

        # Prefer results from fashion domains
        organic.sort(
            key=lambda r: any(
                d in r.get("link", "") for d in FASHION_DOMAINS
            ),
            reverse=True,
        )

        for item in organic[: max_results * 2]:
            try:
                title = item.get("title", "")
                url = item.get("link", "")
                if not title or not url:
                    continue

                source = self._extract_domain(url)

                # Try to extract price from snippet
                snippet = item.get("description", item.get("snippet", ""))
                price = self._parse_price(snippet)

                # Only include if it looks like a product (has price or is from fashion domain)
                if price > 0 or source in FASHION_DOMAINS:
                    products.append(
                        ProductResult(
                            name=title,
                            price=price,
                            source=source,
                            url=url,
                        )
                    )

                if len(products) >= max_results:
                    break

            except Exception as e:
                logger.warning(f"Skipping malformed organic result: {e}")
                continue

        return products

    def _extract_from_html(self, html: str, url: str) -> Optional[ProductResult]:
        """Best-effort product extraction from raw HTML."""
        title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        title = title_match.group(1).strip() if title_match else ""
        if not title:
            return None

        price = self._parse_price(html[:5000])
        source = self._extract_domain(url)

        return ProductResult(
            name=title,
            price=price,
            source=source,
            url=url,
        )

    def _derive_market_signals(
        self,
        query: str,
        products: List[ProductResult],
    ) -> List[MarketSignal]:
        """Derive compact GTM signals from product search evidence."""
        if not products:
            return [
                self._signal(
                    signal_type="product_gap",
                    query=query,
                    source="brightdata",
                    title=f"No live-web matches found for {query}",
                    evidence="Bright Data returned no comparable products for this query.",
                    action="Review whether the catalog needs a new listing or broader search terms.",
                    confidence=0.55,
                )
            ]

        signals: List[MarketSignal] = [
            self._signal(
                signal_type="product_gap",
                query=query,
                source="onpoint_catalog",
                title=f"Catalog gap detected for {query}",
                evidence=(
                    "Internal catalog fallback reached live web discovery; "
                    f"{len(products)} comparable products were found externally."
                ),
                action="Consider adding or promoting a matching Curator listing.",
                confidence=0.78,
            )
        ]

        priced = [p for p in products if p.price > 0]
        if priced:
            prices = [p.price for p in priced]
            low = min(prices)
            high = max(prices)
            currency = priced[0].currency or "USD"
            signals.append(
                self._signal(
                    signal_type="competitor_price",
                    query=query,
                    source="brightdata_serp",
                    title=f"Comparable price range: {currency} {low:.2f}-{high:.2f}",
                    evidence=(
                        f"{len(priced)} priced comparable products found across "
                        f"{self._source_count(priced)} retailers."
                    ),
                    action="Use this range to price or position the closest Curator listing.",
                    confidence=self._bounded_confidence(0.62 + 0.08 * len(priced)),
                    price=low,
                    currency=currency,
                )
            )

        for product in products[:3]:
            signals.append(
                self._signal(
                    signal_type="retailer_availability",
                    query=query,
                    source=product.source,
                    title=product.name,
                    evidence=(
                        f"Live comparable item found on {product.source}"
                        + (f" at {product.currency} {product.price:.2f}." if product.price > 0 else ".")
                    ),
                    action="Use as competitive context for recommendations, listings, or campaign copy.",
                    confidence=0.72 if product.price > 0 else 0.64,
                    url=product.url,
                    price=product.price if product.price > 0 else None,
                    currency=product.currency,
                )
            )

        signals.append(
            self._signal(
                signal_type="recommended_action",
                query=query,
                source="onpoint_agent",
                title=f"Merchandising action for {query}",
                evidence=f"Live web discovery found {len(products)} comparable products for shopper intent.",
                action="Create a Curator-facing recommendation: stock, feature, or source a matching item.",
                confidence=0.7,
            )
        )

        return signals

    def _signal(
        self,
        signal_type: str,
        query: str,
        source: str,
        title: str,
        evidence: str,
        action: str,
        confidence: float,
        url: Optional[str] = None,
        price: Optional[float] = None,
        currency: str = "USD",
    ) -> MarketSignal:
        created_at = datetime.now(timezone.utc).isoformat()
        safe_type = re.sub(r"[^a-z0-9]+", "-", signal_type.lower()).strip("-")
        safe_query = re.sub(r"[^a-z0-9]+", "-", query.lower()).strip("-")[:48] or "query"
        safe_source = re.sub(r"[^a-z0-9]+", "-", source.lower()).strip("-")[:32] or "source"

        return MarketSignal(
            id=f"{safe_type}:{safe_query}:{safe_source}",
            type=signal_type,
            query=query,
            source=source,
            title=title,
            url=url,
            price=price,
            currency=currency,
            confidence=self._bounded_confidence(confidence),
            evidence=evidence,
            action=action,
            created_at=created_at,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    _PRICE_RE = re.compile(r"\$\s?([\d,]+(?:\.\d{2})?)")

    def _bounded_confidence(self, confidence: float) -> float:
        return max(0.0, min(1.0, round(confidence, 2)))

    def _source_count(self, products: List[ProductResult]) -> int:
        return len({p.source for p in products if p.source})

    def _parse_price(self, text: str) -> float:
        """Extract first price from text."""
        if not text:
            return 0.0
        # Handle direct numeric price
        if isinstance(text, (int, float)):
            return float(text)
        match = self._PRICE_RE.search(str(text)[:2000])
        if match:
            return float(match.group(1).replace(",", ""))
        return 0.0

    def _extract_result_source(self, item: dict, url: str) -> str:
        """Prefer merchant labels from structured SERP data over Google redirect URLs."""
        source_fields = (
            "shop",
            "merchant",
            "seller",
            "store",
            "source",
            "domain",
            "displayed_link",
        )
        for key in source_fields:
            value = item.get(key)
            if isinstance(value, str) and value.strip():
                value = value.strip()
                if value.startswith(("http://", "https://")) or "." in value:
                    domain = self._extract_domain(value)
                    if domain != "web":
                        return domain
                return value
        return self._extract_domain(url)

    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL."""
        if not url:
            return "web"
        try:
            parsed = urlparse(url if "://" in url else f"//{url}")
            domain = parsed.netloc
            if domain and "." in domain:
                return domain.replace("www.", "")
            return "web"
        except Exception:
            return "web"
