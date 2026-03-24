# OnPoint Agent Web-Bridge

This Python microservice acts as the "Motor Cortex" for the OnPoint AI Stylist, enabling autonomous web discovery and structured fashion data extraction.

## Tiered Discovery Strategy

The bridge implements a high-performance tiered search to balance speed, cost, and depth:

1.  **Tier 1: Internal Catalog** (Next.js Layer) - Instant, curated results.
2.  **Tier 2: Purch API** (Bridge Layer) - Fast, aggregated search across 1B+ products. Reliable structured data.
3.  **Tier 3: Browser Use Cloud** (Bridge Layer) - Deep-web browsing fallback. Navigates 3rd-party marketplaces like FARFETCH or SSENSE in real-time.

## Features

- **Live Watch UI**: Generates a `live_url` during Tier 3 searches so users can monitor the agent's browser session.
- **Structured Pydantic Models**: Ensures all web results match the OnPoint `FashionItem` schema.
- **Trusted Whitelist**: Prioritizes reputable marketplaces for extraction.

## Setup

1. **Install Dependencies**:
   ```bash
   # Recommended: Use the safe install wrapper (checks security blocklist)
   ./scripts/safe-pip-install.sh -r requirements.txt

   # Or direct pip install
   pip install -r requirements.txt
   ```

2. **Environment Variables**:
   Ensure `BROWSER_USE_API_KEY` is set in `apps/web/.env.local` (the bridge automatically scans this path).

3. **Run Service**:
   ```bash
   python main.py
   ```

## Security

### Blocked Packages

This project maintains a security blocklist (`.pip-blocklist.txt`) of packages known to contain malicious code.

**Currently Blocked:**
- `litellm` - Compromised with credential exfiltration malware (2026-03-24)

### Security Audit

Run the security audit after any dependency changes:

```bash
python security_audit.py
```

### Safe Installation

Always use the safe install wrapper to prevent blocked packages:

```bash
./scripts/safe-pip-install.sh <package-name>
```

## API

- `POST /v1/agent/search`: Main entry point for tiered discovery.
- `GET /health`: Health check.
