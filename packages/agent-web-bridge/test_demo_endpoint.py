"""
Integration test for deterministic market-intelligence demo mode.

Run with: DEMO_MARKET_INTEL=1 pytest test_demo_endpoint.py -v
"""

import os

from fastapi.testclient import TestClient


os.environ["DEMO_MARKET_INTEL"] = "1"
os.environ["ENVIRONMENT"] = "development"

from main import app  # noqa: E402


def test_demo_search_endpoint_returns_products_and_signals():
    client = TestClient(app)

    response = client.post(
        "/v1/agent/search",
        json={
            "userId": "demo-user",
            "query": "black cropped blazer",
            "max_results": 2,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "success"
    assert len(data["items"]) == 2
    assert data["items"][0]["source"] == "zara.com"
    assert {signal["type"] for signal in data["signals"]} >= {
        "product_gap",
        "competitor_price",
        "retailer_availability",
        "recommended_action",
    }
