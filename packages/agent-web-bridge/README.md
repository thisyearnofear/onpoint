# OnPoint Agent Web-Bridge

Python FastAPI bridge for AI agent-powered fashion search and purchases.

## Features

- **Tier 2**: Purch API integration (1B+ products, ~$0.01-0.10 per search)
- **Tier 3**: Browser Use Cloud fallback (any website, ~$0.10-0.50 per session)
- **x402 Protocol**: Cryptographic micropayments via USDC on Solana/Base
- **Security**: Pip blocklist, audit script, credential protection

## Quick Start

### 1. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
# Required: Browser Use Cloud API key
BROWSER_USE_API_KEY=your_key_here

# Optional: Purch wallet for x402 payments (demo mode if not set)
PURCH_WALLET_PRIVATE_KEY=0x...

# Optional: Premium users list
PREMIUM_USERS=user1,user2
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run Security Audit (Recommended)

```bash
python security_audit.py
```

### 4. Start Server

```bash
python main.py
```

Server runs on `http://localhost:8000`

## API Endpoints

### POST /v1/agent/search

Search for fashion items across external marketplaces.

**Request:**
```json
{
  "userId": "user123",
  "query": "black leather jacket",
  "max_results": 3,
  "style_prefs": {
    "price_range": {"min": 50, "max": 300}
  }
}
```

**Response:**
```json
{
  "status": "success",
  "items": [
    {
      "source": "farfetch.com",
      "name": "Black Leather Jacket",
      "price": 129.99,
      "currency": "USD",
      "url": "https://farfetch.com/product/123",
      "image_url": "https://..."
    }
  ],
  "live_url": "https://browser-use.cloud/session/...",
  "session_id": "abc123"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{"status": "healthy"}
```

## Testing

### Run Unit Tests

```bash
pytest test_purch_client.py -v
```

### Run Security Audit

```bash
python security_audit.py
```

Expected output:
```
============================================================
Agent-Web-Bridge Security Audit
============================================================
✅ No suspicious .pth files found
✅ No blocked packages found
✅ No known malicious files found
============================================================
✅ All security checks passed!
```

## Architecture

### Search Tiers

1. **Tier 1**: Local catalog (`CANVAS_ITEMS`) - Fast, free, limited
2. **Tier 2**: Purch API - Comprehensive (1B+ products), costs ~$0.01-0.10
3. **Tier 3**: Browser Use Cloud - Any website, costs ~$0.10-0.50

### Flow

```
User Query → Local Catalog (cache) 
           → Purch API (if local empty)
           → Browser Use Cloud (fallback)
```

### Caching

- Results cached for 24 hours
- Redis-backed in production (Upstash)
- In-memory fallback for development

## Security

### Blocked Packages

See `.pip-blocklist.txt` for blocked packages. Currently blocks:
- `litellm` (compromised 2026-03-24)

### Best Practices

1. **Never commit `.env`** - GitIgnored
2. **Run security audit** after any `pip install`
3. **Rotate credentials** if suspicious activity detected
4. **Use virtual environments** - Isolated dependencies

## Development

### Add New Dependency

1. Add to `requirements.txt` with pinned version
2. Run `pip install -r requirements.txt`
3. Run security audit: `python security_audit.py`
4. Test thoroughly

### Code Style

- Type hints for all functions
- Docstrings for public APIs
- Async/await for I/O operations
- Error handling with logging

## Troubleshooting

### "ModuleNotFoundError: No module named 'purch_client'"

Ensure you're running from the correct directory:
```bash
cd packages/agent-web-bridge
python main.py
```

### "BROWSER_USE_API_KEY not found"

Add to your `.env` file:
```env
BROWSER_USE_API_KEY=your_key_here
```

### Purchase API returns 401

External searches require authentication. Include user ID:
```json
{"userId": "user123", ...}
```

## License

MIT - See LICENSE file

## Support

For issues or questions, open an issue in the main repository.
