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
class BrightDataResult:
    products: List[ProductResult] = field(default_factory=list)
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
                return BrightDataResult(products=products)

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
            return BrightDataResult(products=products)

        except Exception as e:
            logger.error(f"BrightData SERP failed: {e}")
            return BrightDataResult()

    # ------------------------------------------------------------------
    # Web Unlocker — page extraction (for product detail pages)
    # ------------------------------------------------------------------

    async def fetch_product_page(self, url: str) -> Optional[BrightDataProduct]:
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
    ) -> List[BrightDataProduct]:
        """Parse Google Shopping SERP results into products."""
        products: List[BrightDataProduct] = []

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
                source = self._extract_domain(url)
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
    ) -> List[BrightDataProduct]:
        """Parse organic Google search results, filtering for product-like pages."""
        products: List[BrightDataProduct] = []

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

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    _PRICE_RE = re.compile(r"\$\s?([\d,]+(?:\.\d{2})?)")

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
