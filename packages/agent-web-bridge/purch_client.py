"""
Purch API Client

Python async client for Purch.xyz API with x402 protocol support.
Provides access to 1B+ products across major fashion marketplaces.

API Documentation: https://purch.xyz
x402 Protocol: https://www.x402.org/
"""

import os
from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from urllib.parse import urlparse
import httpx


@dataclass
class PurchProduct:
    """Product returned from Purch API search"""
    asin: str
    title: str
    price: float
    image_url: str
    source: str  # Domain (e.g., "farfetch.com")
    source_url: Optional[str] = None  # Full product URL if available


class PurchClient:
    """
    Async client for Purch API with automatic x402 payment handling.
    
    For hackathon/demo: Uses demo mode (no real payments).
    For production: Integrates with wallet for x402 signing.
    """
    
    BASE_URL = "https://api.purch.xyz"
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Purch client.
        
        Args:
            api_key: Optional API key (not required for x402, but may be used for auth)
        """
        self.api_key = api_key or os.getenv("PURCH_API_KEY")
        self.wallet_key = os.getenv("PURCH_WALLET_PRIVATE_KEY")
        
        self.client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            timeout=30.0,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "OnPoint-Agent-Bridge/1.0"
            }
        )
    
    async def search(
        self, 
        query: str, 
        max_results: int = 3
    ) -> List[PurchProduct]:
        """
        Search for products via Purch /x402/shop endpoint.
        
        Handles x402 payment flow automatically:
        1. Initial request (may return 402 Payment Required)
        2. If 402, sign payment challenge
        3. Retry with X-PAYMENT header
        
        Args:
            query: Natural language search query (e.g., "black leather jacket")
            max_results: Maximum number of results to return
            
        Returns:
            List of PurchProduct objects matching the query
        """
        payload = {
            "message": query,
            "max_results": max_results
        }
        
        try:
            # Step 1: Initial request
            response = await self.client.post("/x402/shop", json=payload)
            
            if response.status_code == 200:
                # No payment required (demo mode or cached)
                data = response.json()
                return self._parse_products(data)
            
            elif response.status_code == 402:
                # Payment required - handle x402 flow
                print(f"[Purch] 402 Payment Required - processing challenge")
                challenge = response.json()
                
                payment_header = await self._sign_payment(challenge)
                
                # Retry with payment header
                response = await self.client.post(
                    "/x402/shop",
                    json=payload,
                    headers={"X-PAYMENT": payment_header}
                )
                response.raise_for_status()
                return self._parse_products(response.json())
            
            else:
                # Other error
                response.raise_for_status()
                
        except httpx.HTTPStatusError as e:
            print(f"[Purch] HTTP error: {e.response.status_code} - {e.response.text}")
            raise
        except httpx.RequestError as e:
            print(f"[Purch] Request failed: {e}")
            raise
        except Exception as e:
            print(f"[Purch] Unexpected error: {e}")
            raise
    
    def _parse_products(self, data: Dict[str, Any]) -> List[PurchProduct]:
        """
        Transform Purch API response to typed PurchProduct list.
        
        Args:
            data: Raw JSON response from Purch API
            
        Returns:
            List of PurchProduct objects
        """
        products = []
        
        for product_data in data.get("products", []):
            try:
                product = PurchProduct(
                    asin=product_data["asin"],
                    title=product_data["title"],
                    price=float(product_data["price"]),
                    image_url=product_data.get("imageUrl", ""),
                    source=self._extract_domain(product_data.get("sourceUrl", "")),
                    source_url=product_data.get("sourceUrl")
                )
                products.append(product)
            except (KeyError, ValueError) as e:
                print(f"[Purch] Skipping malformed product: {e}")
                continue
        
        return products
    
    def _extract_domain(self, url: str) -> str:
        """
        Extract domain from URL.
        
        Args:
            url: Full URL (e.g., "https://farfetch.com/product/123")
            
        Returns:
            Domain (e.g., "farfetch.com") or "purch.xyz" if parsing fails
        """
        if not url:
            return "purch.xyz"
        
        try:
            parsed = urlparse(url)
            return parsed.netloc or "purch.xyz"
        except Exception:
            return "purch.xyz"
    
    async def _sign_payment(self, challenge: Dict[str, Any]) -> str:
        """
        Sign x402 payment challenge.
        
        For hackathon: Returns demo payment header.
        For production: Integrates with Tether WDK or similar wallet.
        
        Args:
            challenge: Payment challenge from 402 response
            
        Returns:
            X-PAYMENT header value
        """
        # TODO: Implement proper x402 signing with wallet integration
        # For now, return demo mode header
        
        if self.wallet_key:
            # Production: would sign challenge with wallet
            # This is a placeholder - actual implementation depends on wallet SDK
            print("[Purch] Wallet key present - would sign payment (not implemented)")
            # Placeholder signature
            return f"DEMO_SIGNED_PAYMENT_{challenge.get('amount', 'unknown')}"
        else:
            # Demo mode: use mock payment header
            print("[Purch] No wallet key - using demo payment mode")
            return "DEMO_PAYMENT_HEADER"
    
    async def buy(
        self,
        asin: str,
        email: str,
        shipping_address: Dict[str, str],
        quantity: int = 1
    ) -> Dict[str, Any]:
        """
        Execute purchase via Purch /x402/buy endpoint.
        
        Args:
            asin: Product ASIN from search results
            email: Buyer email address
            shipping_address: Shipping address dict
            quantity: Number of items to purchase
            
        Returns:
            Purchase confirmation with orderId and totalPrice
        """
        payload = {
            "asin": asin,
            "email": email,
            "shippingAddress": shipping_address,
            "quantity": quantity
        }
        
        # Similar x402 flow as search
        response = await self.client.post("/x402/buy", json=payload)
        
        if response.status_code == 402:
            challenge = response.json()
            payment_header = await self._sign_payment(challenge)
            response = await self.client.post(
                "/x402/buy",
                json=payload,
                headers={"X-PAYMENT": payment_header}
            )
        
        response.raise_for_status()
        return response.json()
    
    async def close(self):
        """Close the HTTP client session"""
        await self.client.aclose()
    
    async def __aenter__(self):
        """Async context manager entry"""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()
