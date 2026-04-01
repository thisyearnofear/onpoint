"""
Purch API Client

Python async client for Purch.xyz API with x402 protocol support.
Provides access to 1B+ products across major fashion marketplaces.

API Documentation: https://purch.xyz
x402 Protocol: https://www.x402.org/
"""

import os
import json
import base64
import time
import secrets
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from urllib.parse import urlparse
import httpx
from eth_account import Account
from eth_account.messages import encode_typed_data


@dataclass
class PurchProduct:
    """Product returned from Purch API search"""
    asin: str
    title: str
    price: float
    image_url: str
    source: str  # Domain (e.g., "farfetch.com")
    source_url: Optional[str] = None  # Full product URL if available


@dataclass
class PurchSearchResult:
    """Full search result including reply context and products"""
    reply: str
    products: List[PurchProduct]


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
        result = await self.search_full(query, max_results)
        return result.products
    
    async def search_full(
        self, 
        query: str, 
        max_results: int = 3
    ) -> PurchSearchResult:
        """
        Search for products with full response including Purch's reply context.
        
        Args:
            query: Natural language search query
            max_results: Maximum number of results to return
            
        Returns:
            PurchSearchResult with reply text and products
        """
        payload = {
            "message": query,
            "max_results": max_results
        }
        
        try:
            # Step 1: Initial request
            response = await self.client.post("/x402/shop", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                return self._parse_result(data)
            
            elif response.status_code == 402:
                print(f"[Purch] 402 Payment Required - processing challenge")
                challenge = response.json()
                
                payment_header = await self._sign_payment(challenge)
                
                response = await self.client.post(
                    "/x402/shop",
                    json=payload,
                    headers={"X-PAYMENT": payment_header}
                )
                response.raise_for_status()
                return self._parse_result(response.json())
            
            else:
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
        
        return PurchSearchResult(reply="", products=[])
    
    def _parse_result(self, data: Dict[str, Any]) -> PurchSearchResult:
        """
        Parse full API response into PurchSearchResult with reply context.
        
        Args:
            data: Raw JSON response from Purch API
            
        Returns:
            PurchSearchResult with reply text and products
        """
        reply = data.get("reply", "")
        products = self._parse_products(data)
        return PurchSearchResult(reply=reply, products=products)
    
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
            # urlparse needs // prefix for schemeless URLs like "ssense.com/path"
            parsed = urlparse(url if "://" in url else f"//{url}")
            domain = parsed.netloc
            # Validate it looks like a domain (has a dot and valid chars)
            if domain and "." in domain and not domain.startswith("."):
                return domain
            return "purch.xyz"
        except Exception:
            return "purch.xyz"
    
    async def _sign_payment(self, challenge: Dict[str, Any]) -> str:
        """
        Sign x402 payment challenge using EIP-3009 transferWithAuthorization.

        If PURCH_WALLET_PRIVATE_KEY is set, signs the challenge with the wallet
        using the standard x402 "exact" scheme on EVM (EIP-3009).
        Otherwise, returns a demo payment header for testing.

        Args:
            challenge: Payment challenge from 402 response containing
                       x402Version, scheme, network, resource, accepted, etc.

        Returns:
            Base64-encoded X-PAYMENT header value
        """
        if not self.wallet_key:
            print("[Purch] No wallet key - using demo payment mode")
            return "DEMO_PAYMENT_HEADER"

        try:
            account = Account.from_key(self.wallet_key)
            now = int(time.time())

            # Extract top-level fields
            x402_version = challenge.get("x402Version", 2)
            resource = challenge.get("resource", "")

            # Payment requirements — support both nested (accepted) and flat formats
            accepted = challenge.get("accepted", challenge)
            scheme = accepted.get("scheme", "exact")
            network = accepted.get("network", "base")
            amount = accepted.get("amount", "0")
            asset = accepted.get("asset", "")
            pay_to = accepted.get("payTo", "")
            max_timeout = accepted.get("maxTimeoutSeconds", 300)
            extra = accepted.get("extra", {})

            # Token details (USDC defaults)
            token_name = extra.get("name", "USDC")
            token_version = extra.get("version", "2")
            chain_id = self._network_to_chain_id(network)

            # Compute time window for the authorization
            valid_after = str(challenge.get("validAfter", now - 60))
            valid_before = str(challenge.get("validBefore", now + max_timeout))

            # Convert amount to integer (handle both decimal strings like "0.01"
            # and raw integer strings like "10000")
            raw_amount = str(amount)
            if "." in raw_amount:
                # Decimal amount — convert to USDC's 6-decimal denomination
                amount_int = int(float(raw_amount) * 1_000_000)
            else:
                amount_int = int(raw_amount)

            # Generate a cryptographically random nonce
            nonce = "0x" + secrets.token_hex(32)

            # --- EIP-3009: transferWithAuthorization ---
            # Domain: bound to the specific USDC token contract on the target chain
            typed_data = {
                "types": {
                    "EIP712Domain": [
                        {"name": "name", "type": "string"},
                        {"name": "version", "type": "string"},
                        {"name": "chainId", "type": "uint256"},
                        {"name": "verifyingContract", "type": "address"},
                    ],
                    "TransferWithAuthorization": [
                        {"name": "from", "type": "address"},
                        {"name": "to", "type": "address"},
                        {"name": "value", "type": "uint256"},
                        {"name": "validAfter", "type": "uint256"},
                        {"name": "validBefore", "type": "uint256"},
                        {"name": "nonce", "type": "bytes32"},
                    ],
                },
                "primaryType": "TransferWithAuthorization",
                "domain": {
                    "name": token_name,
                    "version": token_version,
                    "chainId": chain_id,
                    "verifyingContract": asset,
                },
                "message": {
                    "from": account.address,
                    "to": pay_to,
                    "value": amount_int,
                    "validAfter": int(valid_after),
                    "validBefore": int(valid_before),
                    "nonce": nonce,
                },
            }

            # Sign the EIP-712 typed data
            signable = encode_typed_data(full_message=typed_data)
            signed = account.sign_message(signable)
            signature_hex = "0x" + signed.signature.hex()

            # Build x402 v2 PaymentPayload for the "exact" / EIP-3009 scheme
            payment_payload = {
                "x402Version": x402_version,
                "scheme": scheme,
                "network": network,
                "payload": {
                    "signature": signature_hex,
                    "authorization": {
                        "from": account.address,
                        "to": pay_to,
                        "value": str(amount),
                        "validAfter": valid_after,
                        "validBefore": valid_before,
                        "nonce": nonce,
                    },
                },
            }

            # Base64-encode for the X-PAYMENT header
            payment_header = base64.b64encode(
                json.dumps(payment_payload).encode()
            ).decode()

            print(f"[Purch] Signed EIP-3009 payment with wallet {account.address[:10]}...")
            return payment_header

        except Exception as e:
            print(f"[Purch] Wallet signing failed: {e}, falling back to demo mode")
            return "DEMO_PAYMENT_HEADER"
    
    def _network_to_chain_id(self, network: str) -> int:
        """Map network name or EIP-155 identifier to chain ID.

        Supports both plain names ("base") and EIP-155 format ("eip155:8453").
        """
        if ":" in network:
            try:
                return int(network.split(":")[-1])
            except ValueError:
                pass

        chain_ids = {
            "base": 8453,
            "base-sepolia": 84532,
            "ethereum": 1,
            "mainnet": 1,
            "polygon": 137,
            "optimism": 10,
            "arbitrum": 42161,
        }
        return chain_ids.get(network.lower(), 8453)
    
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
