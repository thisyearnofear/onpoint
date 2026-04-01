"""
Unit Tests for Purch Client

Tests the Purch API client with mock HTTP responses.
Run with: pytest test_purch_client.py -v
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
import httpx
from purch_client import PurchClient, PurchProduct


class TestPurchClient:
    """Test suite for PurchClient class"""

    @pytest.fixture
    def client(self):
        """Create a PurchClient instance for testing"""
        return PurchClient(api_key="test_key")

    @pytest.fixture
    def mock_product_data(self):
        """Sample Purch API response"""
        return {
            "reply": "Found 3 products",
            "products": [
                {
                    "asin": "B08XYZ123",
                    "title": "Black Leather Jacket",
                    "price": "129.99",
                    "imageUrl": "https://example.com/image.jpg",
                    "sourceUrl": "https://farfetch.com/product/123"
                },
                {
                    "asin": "B09ABC456",
                    "title": "White Sneakers",
                    "price": "89.50",
                    "imageUrl": "https://example.com/sneakers.jpg",
                    "sourceUrl": "https://ssense.com/product/456"
                }
            ]
        }

    def test_init_with_api_key(self):
        """Test client initialization with API key"""
        client = PurchClient(api_key="test_key")
        assert client.api_key == "test_key"
        assert client.BASE_URL == "https://api.purch.xyz"

    @patch('purch_client.os.getenv')
    def test_init_without_api_key(self, mock_getenv):
        """Test client initialization falls back to env var"""
        mock_getenv.return_value = "env_key"
        client = PurchClient()
        assert client.api_key == "env_key"

    def test_extract_domain_valid_url(self, client):
        """Test domain extraction from valid URL"""
        url = "https://farfetch.com/product/123"
        domain = client._extract_domain(url)
        assert domain == "farfetch.com"

    def test_extract_domain_no_protocol(self, client):
        """Test domain extraction without protocol"""
        url = "ssense.com/product/456"
        domain = client._extract_domain(url)
        assert domain == "ssense.com"

    def test_extract_domain_empty_url(self, client):
        """Test domain extraction from empty URL"""
        domain = client._extract_domain("")
        assert domain == "purch.xyz"

    def test_extract_domain_invalid_url(self, client):
        """Test domain extraction from malformed URL"""
        domain = client._extract_domain("not-a-valid-url")
        assert domain == "purch.xyz"

    def test_parse_products_success(self, client, mock_product_data):
        """Test parsing successful API response"""
        products = client._parse_products(mock_product_data)
        
        assert len(products) == 2
        assert isinstance(products[0], PurchProduct)
        
        # Check first product
        assert products[0].asin == "B08XYZ123"
        assert products[0].title == "Black Leather Jacket"
        assert products[0].price == 129.99
        assert products[0].image_url == "https://example.com/image.jpg"
        assert products[0].source == "farfetch.com"
        assert products[0].source_url == "https://farfetch.com/product/123"
        
        # Check second product
        assert products[1].price == 89.50
        assert products[1].source == "ssense.com"

    def test_parse_products_empty(self, client):
        """Test parsing empty response"""
        products = client._parse_products({"products": []})
        assert len(products) == 0

    def test_parse_products_missing_key(self, client):
        """Test parsing response with missing keys"""
        incomplete_data = {
            "products": [
                {
                    "asin": "B08XYZ",
                    # Missing title, price, etc.
                }
            ]
        }
        products = client._parse_products(incomplete_data)
        # Should skip malformed products
        assert len(products) == 0

    @pytest.mark.asyncio
    async def test_search_200_response(self, client, mock_product_data):
        """Test search with immediate 200 response (no payment required)"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_product_data
        
        with patch.object(client.client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_response
            
            products = await client.search("leather jacket", max_results=3)
            
            assert len(products) == 2
            mock_post.assert_called_once_with(
                "/x402/shop",
                json={"message": "leather jacket", "max_results": 3}
            )

    @pytest.mark.asyncio
    async def test_search_402_payment_required(self, client, mock_product_data):
        """Test search with 402 payment challenge"""
        # First response: 402 Payment Required
        mock_402 = MagicMock()
        mock_402.status_code = 402
        mock_402.json.return_value = {"amount": "0.01", "currency": "USDC"}
        
        # Second response: 200 OK
        mock_200 = MagicMock()
        mock_200.status_code = 200
        mock_200.json.return_value = mock_product_data
        
        with patch.object(client.client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = [mock_402, mock_200]
            
            with patch.object(client, '_sign_payment', return_value="DEMO_PAYMENT"):
                products = await client.search("leather jacket")
                
                assert len(products) == 2
                assert mock_post.call_count == 2
                
                # Verify payment header was included in retry
                second_call = mock_post.call_args_list[1]
                assert "X-PAYMENT" in second_call[1]["headers"]

    @pytest.mark.asyncio
    async def test_search_error_response(self, client):
        """Test search with error response"""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_response.raise_for_status.side_effect = Exception("HTTP 500")
        
        with patch.object(client.client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_response
            
            with pytest.raises(Exception):
                await client.search("test")

    @pytest.mark.asyncio
    async def test_sign_payment_demo_mode(self, client):
        """Test payment signing in demo mode (no wallet key)"""
        challenge = {"amount": "0.01", "currency": "USDC"}
        
        payment_header = await client._sign_payment(challenge)
        
        assert payment_header == "DEMO_PAYMENT_HEADER"

    @pytest.mark.asyncio
    async def test_sign_payment_with_wallet_key(self, client):
        """Test payment signing with wallet key produces valid base64 payload"""
        import json
        import base64
        
        # Use a valid Ethereum private key (test key, not real funds)
        client.wallet_key = "0x4c0883a69102937d6231471b5dbb6204fe512961708279f9d6b80b8a32771700"
        challenge = {
            "amount": "0.01",
            "payTo": "0x1234567890123456789012345678901234567890",
            "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",  # USDC on Base Sepolia
            "network": "base",
            "resource": "test-resource",
            "x402Version": 2,
            "scheme": "exact",
        }
        
        payment_header = await client._sign_payment(challenge)
        
        # Should NOT be demo mode when wallet key is valid
        assert payment_header != "DEMO_PAYMENT_HEADER"
        
        # Should be valid base64-encoded JSON
        decoded = json.loads(base64.b64decode(payment_header))
        assert decoded["x402Version"] == 2
        assert decoded["network"] == "base"
        assert decoded["scheme"] == "exact"
        assert "payload" in decoded
        assert "signature" in decoded["payload"]
        assert decoded["payload"]["signature"].startswith("0x")
        assert "authorization" in decoded["payload"]
        assert decoded["payload"]["authorization"]["to"] == "0x1234567890123456789012345678901234567890"

    @pytest.mark.asyncio
    async def test_sign_payment_fallback_on_error(self, client):
        """Test payment signing falls back to demo on signing errors"""
        # Use an invalid private key
        client.wallet_key = "invalid_key"
        challenge = {"amount": "0.01", "currency": "USDC"}
        
        payment_header = await client._sign_payment(challenge)
        
        # Should gracefully fall back to demo mode
        assert payment_header == "DEMO_PAYMENT_HEADER"

    @pytest.mark.asyncio
    async def test_search_full_returns_reply(self, client, mock_product_data):
        """Test search_full returns reply field from API response"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_product_data
        
        with patch.object(client.client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_response
            
            result = await client.search_full("leather jacket", max_results=3)
            
            assert result.reply == "Found 3 products"
            assert len(result.products) == 2

    @pytest.mark.asyncio
    async def test_search_backward_compat(self, client, mock_product_data):
        """Test search() still returns List[PurchProduct] for backward compat"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_product_data
        
        with patch.object(client.client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_response
            
            products = await client.search("leather jacket")
            
            assert isinstance(products, list)
            assert len(products) == 2
            assert isinstance(products[0], PurchProduct)

    @pytest.mark.asyncio
    async def test_close(self, client):
        """Test closing client session"""
        with patch.object(client.client, 'aclose', new_callable=AsyncMock) as mock_close:
            await client.close()
            mock_close.assert_called_once()

    @pytest.mark.asyncio
    async def test_context_manager(self, client):
        """Test async context manager"""
        with patch.object(client.client, 'aclose', new_callable=AsyncMock) as mock_close:
            async with client:
                pass
            mock_close.assert_called_once()


    @pytest.mark.asyncio
    async def test_buy_success(self, client):
        """Test successful purchase flow (200 response)"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "orderId": "ORD-12345",
            "totalPrice": "129.99",
            "status": "confirmed"
        }
        
        shipping = {"line1": "123 Main St", "city": "NYC", "state": "NY", "zip": "10001", "country": "US"}
        
        with patch.object(client.client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_response
            
            result = await client.buy(
                asin="B08XYZ123",
                email="test@example.com",
                shipping_address=shipping,
                quantity=1
            )
            
            assert result["orderId"] == "ORD-12345"
            assert result["totalPrice"] == "129.99"
            assert result["status"] == "confirmed"
            
            mock_post.assert_called_once_with(
                "/x402/buy",
                json={
                    "asin": "B08XYZ123",
                    "email": "test@example.com",
                    "shippingAddress": shipping,
                    "quantity": 1,
                }
            )

    @pytest.mark.asyncio
    async def test_buy_with_402_payment(self, client):
        """Test buy flow with x402 payment challenge"""
        mock_402 = MagicMock()
        mock_402.status_code = 402
        mock_402.json.return_value = {"amount": "0.05", "currency": "USDC"}
        
        mock_200 = MagicMock()
        mock_200.status_code = 200
        mock_200.json.return_value = {
            "orderId": "ORD-67890",
            "totalPrice": "89.50",
            "status": "confirmed"
        }
        
        shipping = {"line1": "456 Oak Ave", "city": "LA", "state": "CA", "zip": "90001", "country": "US"}
        
        with patch.object(client.client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = [mock_402, mock_200]
            
            result = await client.buy(
                asin="B09ABC456",
                email="buyer@example.com",
                shipping_address=shipping,
                quantity=2
            )
            
            assert result["orderId"] == "ORD-67890"
            assert mock_post.call_count == 2
            
            # Verify payment header was included in retry
            second_call = mock_post.call_args_list[1]
            assert "X-PAYMENT" in second_call[1]["headers"]

    @pytest.mark.asyncio
    async def test_buy_http_error(self, client):
        """Test buy raises on HTTP errors"""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Server error", request=MagicMock(), response=mock_response
        )
        
        shipping = {"line1": "789 Elm St", "city": "SF", "state": "CA", "zip": "94102", "country": "US"}
        
        with patch.object(client.client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_response
            
            with pytest.raises(httpx.HTTPStatusError):
                await client.buy(
                    asin="B08XYZ123",
                    email="test@example.com",
                    shipping_address=shipping
                )

    @pytest.mark.asyncio
    async def test_buy_default_quantity(self, client):
        """Test buy defaults to quantity=1"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"orderId": "ORD-001", "status": "confirmed"}
        
        shipping = {"line1": "1 St", "city": "X", "state": "Y", "zip": "00000", "country": "US"}
        
        with patch.object(client.client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_response
            
            await client.buy(asin="B08XYZ", email="a@b.com", shipping_address=shipping)
            
            call_payload = mock_post.call_args[1]["json"]
            assert call_payload["quantity"] == 1


class TestPurchProduct:
    """Test suite for PurchProduct dataclass"""

    def test_product_creation(self):
        """Test creating a PurchProduct"""
        product = PurchProduct(
            asin="B08XYZ",
            title="Test Product",
            price=99.99,
            image_url="https://example.com/img.jpg",
            source="example.com",
            source_url="https://example.com/product/123"
        )
        
        assert product.asin == "B08XYZ"
        assert product.title == "Test Product"
        assert product.price == 99.99
        assert product.source == "example.com"

    def test_product_optional_fields(self):
        """Test product with optional fields"""
        product = PurchProduct(
            asin="B08XYZ",
            title="Test",
            price=50.0,
            image_url="",
            source="example.com"
            # source_url is optional
        )
        
        assert product.source_url is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
