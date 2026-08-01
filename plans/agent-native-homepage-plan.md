# Agent-Native Homepage Integration Plan

> Weave the Prava agent checkout into the OnPoint web app natively — not as a demo page, but as the product's front door. A judge lands on the site, searches, and watches the full agent flow (discover → try-on → quote → approve → checkout → confirmed) happen inline. The app IS the demo.

## Guiding Principles

1. **The app is the demo.** No separate `/prava-demo` page. The agent flow lives on the homepage.
2. **Same backend, two views.** The iMessage card (`prava-card.js` HTML) and the web card (React component) share the same facade endpoints, state machine, and trust fields. Not duplicated logic — duplicated presentation.
3. **Native, not bolted on.** The search, results, and mutating card use the app's existing Tailwind design system, component patterns, and data-fetching conventions.
4. **Scale is visible.** A live activity feed shows real agent flows. The search surfaces a real UCP brand catalog. Trust fields (scoped credentials) are designed for millions of concurrent purchases.

## What a judge experiences

1. Lands on `beonpoint.netlify.app` → hero has a search input: *"What are you shopping for?"*
2. Types a query (or taps a suggestion chip: "Rooftop brunch", "Date night", "Gym fit")
3. Results appear below: real brand items (Alo Yoga leggings, $111.24, product image)
4. Taps a result → an **AgentCheckoutCard** expands inline below
5. Card shows: product image → "Try it on" → judge uploads a photo (or uses a sample) → IDM-VTON try-on renders
6. Card mutates: try-on image + binding quote ($111.24) + trust fields (spend ceiling, merchant-locked, passkey, guardrails)
7. "Approve with passkey" button → card shows "Placing order" → "✓ Order placed — Prava ord_3jy8dlpq"
8. The activity feed below shows the flow that just happened, alongside other flows
9. Judge can search again, try another brand, see multiple flows accumulate

## Architecture

### New React components (all in `apps/web/components/agent/`)

#### 1. `AgentSearchBar.tsx`
- Client component. A search input with suggestion chips.
- On submit: `POST {apiBase}/prava/search` with the query.
- Calls `onResults(results)` to pass results up to the parent.
- Suggestion chips: pre-canned queries ("Rooftop brunch", "Date night", "Gym fit", "Weekend casual").
- Styled to match the existing hero CTA button group — same rounded-full, gradient, shadow treatment.
- Replaces the primary CTA ("Try on & shop") in the hero.

#### 2. `AgentResults.tsx`
- Client component. Renders search results as a responsive grid.
- Each result card: product image (`SafeImage`), product title, merchant name, price (from `unit_price`), "Style this" button.
- Tapping a result: `POST {apiBase}/prava/order` with `{ query, variantId, merchant }` from the search result → creates an order → calls `onSelectOrder(orderId)` to open the checkout card.
- Grid: `grid grid-cols-2 lg:grid-cols-3 gap-4` — same pattern as NiaPreviewGrid but responsive.
- Empty state: "Search for a style above" with example chips.

#### 3. `AgentCheckoutCard.tsx` — the hero of this build
- Client component. The mutating card, web-native.
- Props: `{ orderId: string }`.
- **Polls** `GET {apiBase}/prava/order/{orderId}` every 3s for state changes (same pattern as the iMessage card's self-polling JS).
- Renders each state natively with Tailwind + the app's design tokens:

| State | What renders |
|-------|-------------|
| `searching` | Skeleton with "Composing your look…" |
| `awaiting_approval` | Product image + "Try it on" button (photo upload) + quote + trust block + "Approve with passkey" button |
| `try_on_ready` | Try-on render image + quote + trust block + "Approve with passkey" button |
| `approved` → `checking_out` | "Placing your order…" spinner |
| `confirmed` | ✓ Try-on image + "Order placed" + Prava order ID + receipt link + "Search again" button |
| `failed` | "Checkout failed" + retry button |

- **Photo upload**: a compact upload zone (reuse `imageFileToDataUrl` from existing VirtualTryOn patterns). Also a "Use sample photo" button that sends a pre-selected Unsplash photo URL (for judges who don't want to upload a personal photo).
- **Approve button**: calls `POST {apiBase}/prava/order/{orderId}/approve` (self-check) — simulates the passkey approval.
- **Checkout**: after approve, automatically calls `POST {apiBase}/prava/order/{orderId}/checkout` — the card flips to "Placing order" then "Confirmed".
- **Trust block**: renders the `order.trust` fields (spend ceiling, merchant scope, credential scope, approval method, guardrails) in a structured layout — the Visa IC story.
- Styling: a `Card`-style container (rounded-2xl, border, shadow) with a gradient header, state pill, and body sections. Matches the iMessage card's visual language but uses Tailwind tokens.

#### 4. `AgentFlow.tsx` — the orchestrator
- Client component. Manages the search → results → checkout card flow.
- State: `{ query, results, orderId }`.
- Renders: `AgentSearchBar` (always) → `AgentResults` (when results) → `AgentCheckoutCard` (when orderId).
- When an order is confirmed, adds it to the activity feed via a callback.
- Lives in a new section on the homepage, replacing the current `#collection` section.

#### 5. `AgentActivityFeed.tsx` (enhance existing)
- Currently at `apps/web/components/AgentActivityFeed.tsx` with demo data.
- Enhance: poll `GET {apiBase}/prava/orders/recent` every 5s.
- Render each order as a timeline entry: merchant, total, state, timestamp.
- Mix real flows (from the facade's in-memory store) with the existing demo data (so the feed is never empty).
- This is the "visualize scaling" piece — as flows accumulate, the feed grows.

### Homepage restructure (`HeroView.tsx`)

**Current section order (14 sections):**
1. WelcomeBackBanner
2. Hero (CTAs: "Try on & shop", "For agents", "List inventory")
3. LiveCommerceProof
4. #collection (NiaPreviewGrid, mobile only)
5. HowItWorks (desktop open, mobile accordion)
6. AgentActivityFeed
7. RecentlySaved
8. Dual-client pitch
9. LookCrafter
10. EditorialStats
11. Digital Fashion Showcase
12. Agent Commerce Section
13. Footer
14. Sticky CTA

**Proposed section order (simplified to 10):**
1. WelcomeBackBanner (keep)
2. **Hero with AgentSearchBar** (search input replaces primary CTA; keep secondary/tertiary CTAs)
3. LiveCommerceProof (keep)
4. **AgentFlow section** (search results + checkout card — replaces #collection; visible on all viewports, not just mobile)
5. HowItWorks (keep — desktop open, mobile accordion)
6. **AgentActivityFeed** (enhanced with real data)
7. RecentlySaved (keep — returns null if empty)
8. LookCrafter (keep — lead magnet)
9. Digital Fashion Showcase (keep — fold the "pitch" and "Agent Commerce Section" into this)
10. Footer + Sticky CTA (sticky CTA → "Try the agent" → scrolls to hero search)

**Key changes:**
- Hero: replace `CTA_SHOP` button with `<AgentSearchBar onResults={...} />`. Keep "For agents" and "List inventory" as secondary CTAs.
- Remove the separate `#collection` section (mobile-only NiaPreviewGrid) — replaced by AgentFlow which is visible on all viewports.
- Remove the "Dual-client pitch" and "Agent Commerce Section" — their content is now demonstrated live by the AgentFlow + ActivityFeed. No need to explain what the user can now experience directly.
- Sticky CTA: label → "Try the agent", onClick → scroll to hero search input.

### API changes

#### `GET /prava/orders/recent` (new endpoint in `prava-facade.js`)
- Returns the last N (default 10) orders from the in-memory store, as `orderView()` objects.
- Used by the AgentActivityFeed to show real flows.
- Service-key authed (same as other facade endpoints).

```js
router.get('/orders/recent', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const recent = [...orders.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map(orderView);
  res.json({ orders: recent });
});
```

### Data flow

```
User types query
  → POST /prava/search { query }
  → results: [{ title, merchant, image, product_id, offers: [{variant_id, price}] }]

User taps a result
  → POST /prava/order { query, variantId, merchant }
  → order: { orderId, state:'awaiting_approval', merchant, totalAmount, paymentUrl, trust, garmentImageUrl }

AgentCheckoutCard polls
  → GET /prava/order/{orderId} (every 3s)
  → { state, merchant, totalAmount, tryOnUrl, trust, orderIdPrava, ... }

User uploads photo
  → POST /prava/order/{orderId}/try-on { photoData }
  → { tryOnUrl, provider, order: { state:'try_on_ready', ... } }

User clicks "Approve"
  → POST /prava/order/{orderId}/approve
  → { state:'approved', ... }
  → (auto) POST /prava/order/{orderId}/checkout
  → { state:'confirmed', order: { orderIdPrava, ... } }

AgentActivityFeed polls
  → GET /prava/orders/recent (every 5s)
  → { orders: [{ state, merchant, totalAmount, ... }] }
```

## Files to create

| File | Purpose |
|------|---------|
| `apps/web/components/agent/AgentSearchBar.tsx` | Search input with suggestion chips |
| `apps/web/components/agent/AgentResults.tsx` | Results grid (brand item cards) |
| `apps/web/components/agent/AgentCheckoutCard.tsx` | The mutating card (React, polls state, all states) |
| `apps/web/components/agent/AgentFlow.tsx` | Orchestrator (search → results → card) |

## Files to modify

| File | Change |
|------|--------|
| `apps/web/components/home/HeroView.tsx` | Replace primary CTA with `<AgentSearchBar>`; add `<AgentFlow>` section; remove #collection, pitch, agent commerce section; simplify to 10 sections; update sticky CTA |
| `apps/web/components/AgentActivityFeed.tsx` | Poll `GET /prava/orders/recent`; render real flows mixed with demo data |
| `apps/api/routes/prava-facade.js` | Add `GET /orders/recent` endpoint |
| `apps/web/lib/utils/analytics.ts` | Add `agent_search` and `agent_checkout` event types |

## What stays unchanged

- `prava-card.js` (iMessage HTML card) — stays as-is for iMessage.
- `prava-facade.js` state machine — no changes to existing endpoints.
- `prava-sandbox.js` — stays as-is.
- `prava-tryon.js` — stays as-is.
- Storefront pages (`/s/[slug]`) — stay as-is (curator storefronts).
- `LookCrafter` — stays as-is (lead magnet).
- Mobile type floor, touch targets, card hierarchy — all the UX fixes from prior rounds stay.

## Verification

1. **Self-check demo**: `node scripts/prava-demo.mjs` — still 15/15 (no backend changes to existing endpoints).
2. **Web dev server**: `pnpm --filter @onpoint/web dev` → visit `localhost:3000`:
   - Hero shows search input (not a button)
   - Type "black legging rooftop brunch" → results appear (Alo Yoga)
   - Tap result → AgentCheckoutCard appears inline
   - Click "Try it on" → upload photo or use sample → try-on renders
   - See quote + trust fields
   - Click "Approve" → card flips to "Placing order" → "✓ Order placed"
   - Activity feed below shows the flow
3. **Type-check**: `cd apps/web && npx tsc --noEmit` — clean.
4. **Lint**: `npx eslint components/agent/ components/home/HeroView.tsx` — clean.
5. **Live server**: after deploy, `curl https://api.onpoint.famile.xyz/prava/health` returns `{"mode":"self-check",...}` and `curl https://api.onpoint.famile.xyz/prava/orders/recent` returns recent orders.

## Build order (within the 48h window)

1. **AgentCheckoutCard** first — it's the core. Build the React component with all states, polling, photo upload, approve/checkout. Test it standalone with a manually-created order ID.
2. **AgentSearchBar + AgentResults** — the search input and results grid. Wire to `/prava/search`.
3. **AgentFlow** — connect search → results → checkout card.
4. **HeroView restructure** — swap the CTA for the search, add the AgentFlow section, remove dead sections.
5. **AgentActivityFeed enhancement** — wire to `/prava/orders/recent`.
6. **API: `GET /prava/orders/recent`** — the one new endpoint.
7. **Polish** — sticky CTA, analytics, empty states, loading states.
