# Web Data UNLOCKED Demo

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
7. End on the action: the Curator can stock, feature, source, or campaign around the missing item.

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

## Proof Points

- Bright Data integration lives in `packages/agent-web-bridge/brightdata_client.py`.
- Demo fixtures live in `packages/agent-web-bridge/demo_fixtures.py`.
- The shopper-to-intel surface lives in `apps/web/components/Dashboard/MarketIntelPanel.tsx`.
- The web API bridge is `apps/web/app/api/market-intelligence/search/route.ts`.
