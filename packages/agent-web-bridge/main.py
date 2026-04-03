from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
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

# Load the environment variables from the web app's .env.local
# This is where the USER specified BROWSER_USE_API_KEY is located.
env_path = os.path.join(os.path.dirname(__file__), "../../apps/web/.env.local")
load_dotenv(dotenv_path=env_path)

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
    live_url: Optional[str] = None
    session_id: Optional[str] = None
    reply: Optional[str] = None


# --- Helpers ---


async def search_purch(query: str, max_results: int = 3) -> PurchSearchResult:
    """
    Tier 2: Search via Purch API (Headless Aggregate).
    Faster and more reliable for common items.
    Returns PurchSearchResult with reply context (triggers Tier 3 fallback if empty).
    """
    client = PurchClient(api_key=os.getenv("PURCH_API_KEY"))

    try:
        logger.info(f"Tier 2: Querying Purch API for '{query}'...")
        result = await client.search_full(query, max_results)

        if not result.products:
            logger.info("Tier 2: No results from Purch")
            return PurchSearchResult(reply="", products=[])

        logger.info(f"Tier 2: Found {len(result.products)} products from Purch")
        if result.reply:
            logger.info(f"Tier 2 Reply: {result.reply}")

        return result

    except Exception as e:
        logger.error(f"Tier 2: Purch API failed: {e}")
        return PurchSearchResult(reply="", products=[])

    finally:
        await client.close()


# --- Endpoints ---


@app.post("/v1/agent/search", response_model=SearchResponse)
async def search_items(
    request: SearchRequest,
    _auth: bool = Depends(verify_api_key),
    _rl: bool = Depends(rate_limit),
):
    """
    Executes a web search for fashion items using the Browser Use Cloud (V3).
    Returns structured results matching the OnPoint catalog schema.
    """
    # --- TIER 2: Aggregated Search via Purch API ---
    purch_result = await search_purch(request.query, request.max_results)
    if purch_result.products:
        purch_items = [
            ItemData(
                source=p.source,
                name=p.title,
                price=p.price,
                currency="USD",
                url=p.source_url or f"https://purch.xyz/product/{p.asin}",
                image_url=p.image_url
            )
            for p in purch_result.products
        ]
        return SearchResponse(
            status="success",
            items=purch_items,
            live_url=None,
            reply=purch_result.reply or None,
        )

    # --- TIER 3: Deep Web Search via Browser Use Cloud (Fallback) ---
    logger.info(f"Tier 3: Falling back to Browser Use Cloud for '{request.query}'...")

    api_key = os.getenv("BROWSER_USE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="BROWSER_USE_API_KEY not configured")

    client = AsyncBrowserUse(api_key=api_key)

    whitelist_str = ", ".join(WHITELIST_DOMAINS)
    task_description = (
        f"Search for fashion items matching: '{request.query}'. "
        f"Extracted result MUST include at most {request.max_results} items. "
        f"PRIORITIZE results from the following trusted marketplaces: {whitelist_str}. "
        "For each item, ensure you capture the source site name, full product name, current price as a number, "
        "the full URL, and a representative product image URL if available. "
        "If metadata is missing, attempt to navigate to the product detail page to extract it."
    )

    try:
        result = await client.run(
            task_description,
            output_schema=SearchResults,
            model="bu-max"
        )

        return SearchResponse(
            status="success",
            items=result.output.items,
            live_url=result.live_url,
            session_id=str(result.id)
        )

    except Exception as e:
        logger.error(f"Browser Use Cloud failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host=host, port=port)
