"""
Deterministic market-intelligence fixtures for hackathon demos.

Enabled with DEMO_MARKET_INTEL=1. This keeps the demo path reliable when live
providers are unavailable, while leaving production behavior unchanged.
"""

from brightdata_client import BrightDataClient, BrightDataResult, ProductResult


DEMO_PRODUCTS = {
    "black cropped blazer": [
        ProductResult(
            name="Black Cropped Tailored Blazer",
            price=89.0,
            source="zara.com",
            url="https://www.zara.com/us/en/search?searchTerm=black%20cropped%20blazer",
            image_url="https://static.zara.net/photos///contents/mkt/spots/aw25-north-woman-new/subhome-xmedia-45//w/1920/IMAGE-landscape-fill-5b9f1312-235f-4a2e-9b8f-bad9a58f5a0f-default_0.jpg",
        ),
        ProductResult(
            name="Cropped Wool Blend Blazer",
            price=148.0,
            source="nordstrom.com",
            url="https://www.nordstrom.com/sr?keyword=black%20cropped%20blazer",
        ),
        ProductResult(
            name="Structured Cropped Jacket",
            price=215.0,
            source="ssense.com",
            url="https://www.ssense.com/en-us/women?q=black%20cropped%20blazer",
        ),
    ],
    "red loafers": [
        ProductResult(
            name="Red Leather Loafers",
            price=129.0,
            source="farfetch.com",
            url="https://www.farfetch.com/shopping/women/search/items.aspx?q=red%20loafers",
        ),
        ProductResult(
            name="Burgundy Penny Loafers",
            price=98.0,
            source="asos.com",
            url="https://www.asos.com/search/?q=red%20loafers",
        ),
    ],
    "linen summer dress": [
        ProductResult(
            name="Linen Blend Midi Dress",
            price=79.0,
            source="hm.com",
            url="https://www2.hm.com/en_us/search-results.html?q=linen%20summer%20dress",
        ),
        ProductResult(
            name="Sleeveless Linen Dress",
            price=158.0,
            source="net-a-porter.com",
            url="https://www.net-a-porter.com/en-us/shop/search/linen%20dress",
        ),
    ],
}


def demo_market_intel_result(query: str, max_results: int = 3) -> BrightDataResult:
    normalized = query.strip().lower()
    products = DEMO_PRODUCTS.get(normalized)

    if products is None:
        products = DEMO_PRODUCTS["black cropped blazer"]

    products = products[:max_results]
    client = BrightDataClient(api_key="demo")
    return BrightDataResult(
        products=products,
        signals=client._derive_market_signals(query, products),
    )
