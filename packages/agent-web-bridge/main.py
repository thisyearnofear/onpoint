from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uvicorn
from browser_use_sdk.v3 import AsyncBrowserUse
import os
import time
import logging
from collections import defaultdict
from dotenv import load_dotenv
import asyncio
from purch_client import PurchClient, PurchProduct, PurchSearchResult
from tinyfish_client import TinyFishClient, TinyFishResult
from brightdata_client import BrightDataClient, BrightDataResult
from demo_fixtures import demo_market_intel_result

bridge_env_path = os.path.join(os.path.dirname(__file__), ".env")
web_env_path = os.path.join(os.path.dirname(__file__), "../../apps/web/.env.local")

# Production bridge secrets live beside the Python service. The web .env.local
# fallback preserves the existing local development setup.
load_dotenv(dotenv_path=bridge_env_path)
load_dotenv(dotenv_path=web_env_path)

logger = logging.getLogger("bridge")

app = FastAPI(title="OnPoint Agent Web-Bridge (Cloud V3)")

# --- Config ---

PURCH_API_URL = "https://api.purch.xyz/v1/search"
BRIDGE_API_KEY = os.getenv("BRIDGE_API_KEY", "")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

# --- CORS ---

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# --- Auth ---

api_key_header = APIKeyHeader(name="Authorization", auto_error=False)


async def verify_api_key(authorization: Optional[str] = Depends(api_key_header)):
    """Validate the Bearer token against BRIDGE_API_KEY."""
    if not BRIDGE_API_KEY:
        # No key configured = open access (dev mode only)
        if ENVIRONMENT == "production":
            logger.error("BRIDGE_API_KEY not set in production — denying all requests")
            raise HTTPException(status_code=500, detail="Server misconfigured: no API key")
        return True

    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = authorization.removeprefix("Bearer ").strip()
    if token != BRIDGE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

    return True


# --- Rate Limiting (in-memory, per-IP, fixed window) ---

_rate_limit_store: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"count": 0, "reset_at": 0})
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 30  # requests per window


async def rate_limit(request: Request):
    """Simple per-IP rate limiting."""
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    entry = _rate_limit_store[client_ip]

    if now > entry["reset_at"]:
        entry["count"] = 0
        entry["reset_at"] = now + RATE_LIMIT_WINDOW

    entry["count"] += 1
    if entry["count"] > RATE_LIMIT_MAX:
        retry_after = int(entry["reset_at"] - now)
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded",
            headers={"Retry-After": str(retry_after)},
        )


# Whitelist of agent-friendly fashion marketplaces
WHITELIST_DOMAINS = [
    "farfetch.com",
    "ssense.com",
    "zara.com",
    "asos.com",
    "hm.com",
    "nordstrom.com",
    "net-a-porter.com"
]

# --- Models ---


class ItemData(BaseModel):
    source: str
    name: str
    price: float
    currency: str = "USD"
    url: str
    image_url: Optional[str] = None


class MarketSignalData(BaseModel):
    id: str
    type: str
    query: str
    source: str
    title: str
    evidence: str
    action: str
    confidence: float
    createdAt: str
    url: Optional[str] = None
    price: Optional[float] = None
    currency: str = "USD"


class SearchResults(BaseModel):
    items: List[ItemData]


class StylePrefs(BaseModel):
    colors: List[str] = []
    categories: List[str] = []
    price_range: Dict[str, float] = {"min": 0, "max": 500}


class SearchRequest(BaseModel):
    userId: str
    query: str
    style_prefs: Optional[StylePrefs] = None
    max_results: int = 3


class SearchResponse(BaseModel):
    status: str
    items: List[ItemData]
    signals: List[MarketSignalData] = Field(default_factory=list)
    live_url: Optional[str] = None
    session_id: Optional[str] = None
    reply: Optional[str] = None


# --- Helpers ---


async def search_purch(query: str, max_results: int = 3) -> PurchSearchResult:
    """Tier 2: Search via Purch API (Headless Aggregate)."""
    client = PurchClient(api_key=os.getenv("PURCH_API_KEY"))

    try:
        logger.info(f"Tier 2: Querying Purch API for '{query}'...")
        result = await client.search_full(query, max_results)

        if not result.products:
            logger.info("Tier 2: No results from Purch")
            return PurchSearchResult(reply="", products=[])

        logger.info(f"Tier 2: Found {len(result.products)} products from Purch")
        return result

    except Exception as e:
        logger.error(f"Tier 2: Purch API failed: {e}")
        return PurchSearchResult(reply="", products=[])

    finally:
        await client.close()


def _tinyfish_to_items(result: TinyFishResult) -> List[ItemData]:
    """Convert TinyFish products to bridge ItemData format."""
    return [
        ItemData(
            source=p.source,
            name=p.name,
            price=p.price,
            currency=p.currency,
            url=p.url,
            image_url=p.image_url,
        )
        for p in result.products
    ]


def _brightdata_to_items(result: BrightDataResult) -> List[ItemData]:
    """Convert BrightData products to bridge ItemData format."""
    return [
        ItemData(
            source=p.source,
            name=p.name,
            price=p.price,
            currency=p.currency,
            url=p.url,
            image_url=p.image_url,
        )
        for p in result.products
    ]


def _brightdata_to_signals(result: BrightDataResult) -> List[MarketSignalData]:
    """Convert BrightData market signals to bridge response format."""
    return [
        MarketSignalData(
            id=s.id,
            type=s.type,
            query=s.query,
            source=s.source,
            title=s.title,
            url=s.url,
            price=s.price,
            currency=s.currency,
            confidence=s.confidence,
            evidence=s.evidence,
            action=s.action,
            createdAt=s.created_at,
        )
        for s in result.signals
    ]


# --- Endpoints ---


@app.post("/v1/agent/search", response_model=SearchResponse)
async def search_items(
    request: SearchRequest,
    _auth: bool = Depends(verify_api_key),
    _rl: bool = Depends(rate_limit),
):
    """
    Multi-tier fashion product search with redundant providers.

    Tier 2:   Purch API (fast aggregate)
    Tier 2.5: TinyFish + Bright Data SERP (parallel, first-result-wins)
    Tier 3:   Browser Use Cloud || TinyFish Agent (deep browsing fallback)
    """
    query = request.query
    max_results = request.max_results

    if os.getenv("DEMO_MARKET_INTEL") == "1":
        demo_result = demo_market_intel_result(query, max_results)
        return SearchResponse(
            status="success",
            items=_brightdata_to_items(demo_result),
            signals=_brightdata_to_signals(demo_result),
            reply="Demo market-intelligence fixture",
        )

    # --- TIER 2: Purch API ---
    purch_result = await search_purch(query, max_results)
    if purch_result.products:
        return SearchResponse(
            status="success",
            items=[
                ItemData(
                    source=p.source,
                    name=p.title,
                    price=p.price,
                    currency="USD",
                    url=p.source_url or f"https://purch.xyz/product/{p.asin}",
                    image_url=p.image_url,
                )
                for p in purch_result.products
            ],
            reply=purch_result.reply or None,
        )

    # --- TIER 2.5: TinyFish + Bright Data in parallel (fast, structured) ---
    tf = TinyFishClient()
    bd = BrightDataClient()

    async def _try_tinyfish() -> Optional[TinyFishResult]:
        if not tf.available:
            return None
        result = await tf.search_and_fetch(query, max_results)
        return result if result.products else None

    async def _try_brightdata() -> Optional[BrightDataResult]:
        if not bd.available:
            return None
        result = await bd.search_products(query, max_results)
        return result if result.products else None

    try:
        results = await asyncio.gather(
            _try_tinyfish(),
            _try_brightdata(),
            return_exceptions=True,
        )

        # First non-empty, non-exception result wins
        for result in results:
            if isinstance(result, Exception):
                logger.warning(f"Tier 2.5 provider failed: {result}")
                continue
            if result is None:
                continue

            if isinstance(result, TinyFishResult):
                return SearchResponse(
                    status="success",
                    items=_tinyfish_to_items(result),
                )
            elif isinstance(result, BrightDataResult):
                return SearchResponse(
                    status="success",
                    items=_brightdata_to_items(result),
                    signals=_brightdata_to_signals(result),
                )
    finally:
        await tf.close()
        await bd.close()

    # --- TIER 3: Deep browsing — try Browser Use first, fall back to TinyFish Agent ---
    logger.info(f"Tier 3: Deep browsing for '{query}'...")

    bu_api_key = os.getenv("BROWSER_USE_API_KEY")
    if bu_api_key:
        try:
            client = AsyncBrowserUse(api_key=bu_api_key)
            whitelist_str = ", ".join(WHITELIST_DOMAINS)
            task_description = (
                f"Search for fashion items matching: '{query}'. "
                f"Extracted result MUST include at most {max_results} items. "
                f"PRIORITIZE results from the following trusted marketplaces: {whitelist_str}. "
                "For each item, ensure you capture the source site name, full product name, current price as a number, "
                "the full URL, and a representative product image URL if available. "
                "If metadata is missing, attempt to navigate to the product detail page to extract it."
            )
            result = await client.run(
                task_description,
                output_schema=SearchResults,
                model="bu-max",
            )
            return SearchResponse(
                status="success",
                items=result.output.items,
                live_url=result.live_url,
                session_id=str(result.id),
            )
        except Exception as e:
            logger.error(f"Tier 3 Browser Use failed: {e}")

    # Tier 3 fallback: TinyFish Agent (redundancy for Browser Use)
    tf = TinyFishClient()
    if tf.available:
        tf_result = await tf.agent_browse(query, max_results)
        await tf.close()
        if tf_result.products:
            return SearchResponse(
                status="success",
                items=_tinyfish_to_items(tf_result),
                live_url=tf_result.live_url,
            )

    raise HTTPException(
        status_code=503,
        detail="All search providers exhausted. Configure BROWSER_USE_API_KEY or TINYFISH_API_KEY.",
    )


@app.get("/health")
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host=host, port=port)
