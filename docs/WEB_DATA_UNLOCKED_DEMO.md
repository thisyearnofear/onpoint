# Web Data UNLOCKED Demo

## Submission Copy

**Project title:** OnPoint Retail Intelligence Agent

**Short description:** An AI stylist and retail intelligence agent that turns shopper intent, try-on feedback, and live web signals into personalized outfit guidance plus GTM insights on product gaps, pricing, and competitor availability.

**Long description:** OnPoint is a dual-purpose AI fashion agent for shoppers and retail teams. For consumers, it acts as a personal stylist: users can upload a photo, explore outfit ideas, receive fit and style guidance, and discover looks matched to their preferences. For retail and creator-led commerce teams, OnPoint turns those same shopper intents into market intelligence.

Using Bright Data-powered live web access, OnPoint monitors real-time search and shopping signals to identify product gaps, competitor pricing, retailer availability, and merchandising opportunities. If a shopper searches for something missing from the catalog, OnPoint can surface comparable products across the web, estimate price ranges, and recommend the next action for a curator or merchant.

The result is a consumer-facing styling experience with an enterprise GTM intelligence layer underneath: better recommendations for shoppers, faster product decisions for sellers, and live evidence for teams that need to react to fashion demand as it emerges.

**Track:** GTM Intelligence

**Category tags:** AI agents, retail intelligence, ecommerce, web data, product discovery, fashion tech, Bright Data, SERP API, Web Unlocker, AI/ML API, Cognee, TriggerWare

**Tech stack:** Next.js, React, TypeScript, Python FastAPI, Bright Data SERP API, Bright Data Web Unlocker, AI/ML API merchant briefs, Cognee-ready agent memory, TriggerWare workflow events, Redis-compatible caching, Vitest, Pytest

## Positioning

OnPoint is a consumer styling agent that also creates retail GTM intelligence. A shopper gets product recommendations; the Curator gets live market signals about product gaps, competitor pricing, retailer availability, and the next merchandising action.

## Track

GTM Intelligence, with fashion retail as the vertical.

## Demo Flow

1. Open the app and start from the consumer styling/shopper experience.
2. Search or trigger intent for `black cropped blazer`.
3. Show the catalog gap: OnPoint falls through from curated inventory to live web discovery.
4. Show Bright Data-powered results: comparable products, prices, retailers, and URLs.
5. Open the `Intel` tab.
6. Walk through the summary row:
   - Product gaps
   - Competitor price range
   - Retailers found
   - Next action status
7. Show partner actions:
   - AI/ML API merchant brief
   - Cognee-ready memory
   - TriggerWare merchandising workflow
8. End on the action: the Curator can stock, feature, source, or campaign around the missing item.

## Reliable Demo Mode

Use deterministic fixtures when live provider credentials or network conditions are risky:

```bash
DEMO_MARKET_INTEL=1 HOST=127.0.0.1 PORT=8317 ./venv/bin/python main.py
```

Then run the web app with:

```bash
EXTERNAL_AGENT_URL=http://127.0.0.1:8317 pnpm exec next dev --turbopack --port 3317
```

Recommended demo queries:

- `black cropped blazer`
- `red loafers`
- `linen summer dress`

## Live Bright Data Verification

Before recording or submitting, run one live check with `DEMO_MARKET_INTEL` unset and `BRIGHTDATA_API_KEY` configured:

```bash
cd packages/agent-web-bridge
BRIGHTDATA_API_KEY=<key> ./venv/bin/python - <<'PY'
import asyncio
from brightdata_client import BrightDataClient

async def main():
    client = BrightDataClient()
    result = await client.search_products("black cropped blazer", max_results=3)
    await client.close()
    print({
        "products": len(result.products),
        "signals": [signal.type for signal in result.signals],
        "sources": [product.source for product in result.products],
    })

asyncio.run(main())
PY
```

Expected proof:

- `products` is greater than `0`
- `signals` includes `competitor_price` and `retailer_availability`
- `sources` includes live retailer domains

## Proof Points

- Bright Data integration lives in `packages/agent-web-bridge/brightdata_client.py`.
- Demo fixtures live in `packages/agent-web-bridge/demo_fixtures.py`.
- Partner enrichment lives in `apps/web/lib/services/retail-signal-partners.ts`.
- The shopper-to-intel surface lives in `apps/web/components/Dashboard/MarketIntelPanel.tsx`.
- The web API bridge is `apps/web/app/api/market-intelligence/search/route.ts`.

## Judging Criteria Mapping

**Application of technology:** Bright Data sits inside the existing agent web bridge as a Tier 2.5 provider. SERP results become product recommendations and market signals through one normalized response shape. AI/ML API turns those signals into a merchant brief, Cognee stores them as agent memory, and TriggerWare prepares the merchandising workflow.

**Presentation:** The demo shows one shopper intent becoming two outputs: consumer recommendations and Curator-facing GTM intelligence.

**Business value:** Retailers and Curators get live demand and competitor context before deciding what to stock, promote, source, or campaign around.

**Originality:** OnPoint uses consumer styling as the demand-capture wedge, then converts those sessions into structured market intelligence instead of treating shopping recommendations as a one-off consumer interaction.

## 90-Second Script

1. "OnPoint starts as a consumer styling agent. The shopper asks for a look or missing item."
2. "If the Curator catalog cannot satisfy that intent, the agent searches the live web through Bright Data."
3. "The shopper sees comparable products with real retailers and prices."
4. "The same event creates GTM intelligence: product gap, competitor price range, retailer availability, and a recommended merchandising action."
5. "AI/ML API converts the live evidence into a merchant brief, Cognee gives the agent memory, and TriggerWare turns the signal into an operational workflow."
6. "This lets a boutique, stylist, or creator seller act on real shopper demand instead of stale analytics."
