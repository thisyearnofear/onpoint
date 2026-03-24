from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn
from browser_use_sdk.v3 import AsyncBrowserUse
import os
from dotenv import load_dotenv
import asyncio

# Load the environment variables from the web app's .env.local
# This is where the USER specified BROWSER_USE_API_KEY is located.
env_path = os.path.join(os.path.dirname(__file__), "../../apps/web/.env.local")
load_dotenv(dotenv_path=env_path)

app = FastAPI(title="OnPoint Agent Web-Bridge (Cloud V3)")

# --- Config ---

PURCH_API_URL = "https://api.purch.xyz/v1/search"

# --- Config ---

# Whitelist of agent-friendly fashion marketplaces
# These sites have high-quality product data and reliable layouts for extraction.
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

# --- Helpers ---

async def search_purch(query: str, max_results: int = 3) -> List[ItemData]:
    """
    Tier 2: Search via Purch API (Headless Aggregate).
    Faster and more reliable for common items.
    """
    try:
        # Note: Purch uses X402 protocol / micropayments. 
        # For now we use the public search if available or a mock for demo.
        # In production, this would be: 
        # response = await httpx.post(PURCH_API_URL, json={"query": query})
        
        # Placeholder for Purch API Integration
        # return [ItemData(**item) for item in response.json()['items']]
        
        print(f"[Bridge] Tier 2: Querying Purch API for '{query}'...")
        # Simulating a potential empty result to force tier 3 fallback for niche items
        return [] 
    except Exception as e:
        print(f"Purch API failed: {e}")
        return []

# --- Endpoints ---

@app.post("/v1/agent/search", response_model=SearchResponse)
async def search_items(request: SearchRequest):
    """
    Executes a web search for fashion items using the Browser Use Cloud (V3).
    Returns structured results matching the OnPoint catalog schema.
    """
    # --- TIER 2: Aggregated Search via Purch API ---
    purch_items = await search_purch(request.query, request.max_results)
    if purch_items:
        return SearchResponse(
            status="success",
            items=purch_items,
            live_url=None # Purch is an API, no live browser URL
        )

    # --- TIER 3: Deep Web Search via Browser Use Cloud (Fallback) ---
    print(f"[Bridge] Tier 3: Falling back to Browser Use Cloud for '{request.query}'...")
    
    api_key = os.getenv("BROWSER_USE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="BROWSER_USE_API_KEY not found in .env.local")

    # Initialize the Cloud Client
    client = AsyncBrowserUse(api_key=api_key)

    # Detailed prompt for high-fidelity extraction
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
        # Using BU Agent API v3 (Experimental) for structured output
        # It handles all the browser orchestration, stealth, and proxies in the cloud.
        result = await client.run(
            task_description,
            output_schema=SearchResults,
            model="bu-max" # Use bu-max for more accurate extraction on complex fashion sites
        )

        # result.output is already typed to SearchResults Pydantic model
        return SearchResponse(
            status="success",
            items=result.output.items,
            live_url=result.live_url,
            session_id=str(result.id)
        )

    except Exception as e:
        print(f"Browser Use Cloud failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
