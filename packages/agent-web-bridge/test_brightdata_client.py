"""
Unit tests for Bright Data client signal derivation.

Run with: pytest test_brightdata_client.py -v
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from brightdata_client import BrightDataClient, ProductResult, MarketSignal
from demo_fixtures import demo_market_intel_result


class TestBrightDataClient:
    @pytest.fixture
    def client(self):
        return BrightDataClient(api_key="test_key")

    @pytest.fixture
    def shopping_response(self):
        return {
            "shopping": [
                {
                    "title": "Black Cropped Blazer",
                    "price": "$89.00",
                    "link": "https://zara.com/us/black-cropped-blazer",
                    "thumbnail": "https://example.com/blazer.jpg",
                },
                {
                    "title": "Tailored Black Blazer",
                    "extracted_price": 149.5,
                    "url": "https://nordstrom.com/product/tailored-blazer",
                    "image": "https://example.com/tailored.jpg",
                },
            ]
        }

    def test_available_requires_api_key(self):
        assert BrightDataClient(api_key="test_key").available is True
        assert BrightDataClient(api_key="").available is False

    def test_parse_serp_results(self, client, shopping_response):
        products = client._parse_serp_results(shopping_response, max_results=3)

        assert len(products) == 2
        assert products[0].name == "Black Cropped Blazer"
        assert products[0].price == 89.0
        assert products[0].source == "zara.com"
        assert products[1].price == 149.5
        assert products[1].source == "nordstrom.com"

    def test_parse_serp_results_prefers_shop_source(self, client):
        response = {
            "shopping": [
                {
                    "title": "Zara Cropped Blazer",
                    "price": "$79.90",
                    "shop": "Zara",
                    "link": "https://www.google.com/search?ibp=oshop&q=Zara+Cropped+Blazer",
                    "image": "https://example.com/zara.jpg",
                }
            ]
        }

        products = client._parse_serp_results(response, max_results=3)

        assert len(products) == 1
        assert products[0].source == "Zara"
        assert products[0].url.startswith("https://www.google.com/search")

    def test_derive_market_signals_from_products(self, client):
        products = [
            ProductResult(
                name="Black Cropped Blazer",
                price=89,
                source="zara.com",
                url="https://zara.com/blazer",
            ),
            ProductResult(
                name="Tailored Black Blazer",
                price=149,
                source="nordstrom.com",
                url="https://nordstrom.com/blazer",
            ),
        ]

        signals = client._derive_market_signals("black cropped blazer", products)

        assert len(signals) == 5
        assert all(isinstance(signal, MarketSignal) for signal in signals)
        assert {signal.type for signal in signals} == {
            "product_gap",
            "competitor_price",
            "retailer_availability",
            "recommended_action",
        }

        price_signal = next(s for s in signals if s.type == "competitor_price")
        assert price_signal.price == 89
        assert "89.00-149.00" in price_signal.title
        assert 0 <= price_signal.confidence <= 1

    def test_derive_product_gap_when_no_products(self, client):
        signals = client._derive_market_signals("red loafers", [])

        assert len(signals) == 1
        assert signals[0].type == "product_gap"
        assert signals[0].query == "red loafers"
        assert signals[0].action
        assert 0 <= signals[0].confidence <= 1

    @pytest.mark.asyncio
    async def test_search_products_returns_products_and_signals(self, client, shopping_response):
        mock_response = MagicMock()
        mock_response.json.return_value = shopping_response
        mock_response.raise_for_status.return_value = None

        with patch.object(client._client, "post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_response

            result = await client.search_products("black cropped blazer", max_results=3)

        assert len(result.products) == 2
        assert any(signal.type == "competitor_price" for signal in result.signals)
        mock_post.assert_called_once()

    @pytest.mark.asyncio
    async def test_search_products_skips_without_api_key(self):
        client = BrightDataClient(api_key="")

        result = await client.search_products("black cropped blazer")

        assert result.products == []
        assert result.signals == []

    def test_demo_market_intel_result_is_deterministic(self):
        result = demo_market_intel_result("black cropped blazer", max_results=2)

        assert len(result.products) == 2
        assert result.products[0].source == "zara.com"
        assert any(signal.type == "recommended_action" for signal in result.signals)
