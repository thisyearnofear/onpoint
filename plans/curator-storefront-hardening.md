# Curator Storefront Hardening Plan

## Context

The `/s/[slug]` curator storefront (545 lines) and the full curator surface (~60 files across api, web, packages) are structurally sound — no missing features, no TODOs, all 14 Next.js API routes and 3 Express routes work. The ADR-0002 schema, DB models, self-serve onboarding, M-Pesa payments, admin CRUD, analytics tracking, cross-curator recommendations, and AI stylist integration are all implemented.

The gaps are in **production readiness**, not features. Following the Core Principles, the plan enhances existing components, consolidates duplicates, adds essential testing, and removes nothing that isn't dead weight.

## Issues by Severity

| # | Severity | Area | Issue | Principle |
|---|---|---|---|---|
| 1 | Blocking | `page.tsx` | No error boundary — unhandled fetch exception crashes SSR page | CLEAN |
| 2 | Blocking | `s/[slug]/` | No `loading.tsx` — blank screen during data fetch | PERFORMANT |
| 3 | Blocking | `page.tsx` | Inlines partial `CuratorStorefront` type instead of importing from `@onpoint/shared-types` — 15 fields omitted | DRY |
| 4 | Blocking | `MpesaPaymentPanel.tsx` | Only renders M-Pesa UI — ignores `shopify`/`stripe` checkout types | MODULAR |
| 5 | Blocking | *(missing)* | Zero test files for any curator functionality | MODULAR |
| 6 | Medium | `page.tsx` | `formatMoney()` hardcodes `KES` / `en-KE` — not configurable per curator region | ENHANCEMENT |
| 7 | Medium | `intel/page.tsx` | `params.slug` force-cast to string — `useParams()` can return null | CLEAN |
| 8 | Medium | `curator-admin.js` | No pagination on list endpoints — unbounded DB queries | PERFORMANT |
| 9 | Low | `page.tsx` | Hardcoded marketing copy in 5 places — curator brand should drive tone | ENHANCEMENT |

## Implementation Plan

### Step 1 — Fix DRY violation: use shared types (ENHANCEMENT, DRY)

**Files:** `apps/web/app/s/[slug]/page.tsx`, `packages/shared-types/src/curator.ts`

- Delete the inlined `CuratorStorefront` type (lines 24–79) from `page.tsx`
- Add the missing fields to the shared `Curator` type if needed (`mpesaNumber` on `commerce`)
- Import `Curator` and `Listing` from `@onpoint/shared-types` instead
- Update the `loadStorefront` return type to use the shared types
- Verify: page type-checks, no new TS errors

This is the single biggest DRY win — the inlined type omits 15 fields that exist in the API response, meaning the page silently drops data it could be using (avatar, collaborators, photoKeys, timestamps).

### Step 2 — Add error boundary (CLEAN)

**Files:** `apps/web/app/s/[slug]/error.tsx` (new)

- Minimal `"use client"` error component following Next.js App Router convention
- Shows "Storefront unavailable" with retry button
- Logs error details in dev mode
- Follows the same pattern as any existing `error.tsx` in the codebase

### Step 3 — Add loading state (PERFORMANT)

**Files:** `apps/web/app/s/[slug]/loading.tsx` (new)

- Skeleton UI matching the page structure (header, sidebar, listing grid)
- Uses the same Tailwind classes as the page for seamless transition
- Minimal — just enough to prevent layout shift

### Step 4 — Fix checkout type handling in MpesaPaymentPanel (MODULAR, ENHANCEMENT)

**Files:** `apps/web/app/s/[slug]/MpesaPaymentPanel.tsx`

- Add a `checkoutType` prop: `"whatsapp" | "mpesa" | "shopify" | "stripe"`
- When `checkoutType === "whatsapp"`, show the WhatsApp deep link directly instead of M-Pesa form
- When `checkoutType === "shopify"` or `"stripe"`, show a redirect button
- When `checkoutType === "mpesa"`, keep the existing M-Pesa flow
- Pass `curator.commerce.checkout` from the parent page

This makes the component handle the full `Curator.commerce.checkout` union instead of silently assuming M-Pesa.

### Step 5 — Add tests (MODULAR)

**Files:**
- `apps/api/routes/__tests__/curator-storefront.test.js` (new)
- `apps/web/app/s/[slug]/__tests__/page.test.tsx` (new)

**API tests:**
- `GET /:slug/storefront` returns `404` for unknown slug
- `GET /:slug/storefront` returns `400` for invalid slug
- `GET /:slug/storefront` returns 503 when NEON_DATABASE_URL is unset

**Page tests:**
- Renders curator name from storefront data
- Renders listing grid with items
- Renders empty state when no listings
- Renders `notFound()` when storefront is `null`

### Step 6 — De-duplicate ApiBase pattern (DRY)

**Files:** `apps/web/app/s/[slug]/page.tsx`, `apps/web/app/curator/onboard/page.tsx`

- Both files inline the same `getApiBase()` / `API_BASE` logic with the same hardcoded `http://localhost:48751` fallback
- Extract to `apps/web/lib/utils/api-base.ts` — single `getAgentApiUrl()` function

### Step 7 — Pagination on admin endpoints (PERFORMANT)

**Files:** `apps/api/routes/curator-admin.js`

- Add optional `?limit=50&offset=0` query params to `GET /` and `GET /:slug/listings`
- Default to no limit for backwards compatibility
- Return `meta: { total, limit, offset }` in response

### Step 8 — Fix params.slug unsafe cast (CLEAN)

**Files:** `apps/web/app/s/[slug]/intel/page.tsx`

- Add null guard: `const slug = params.slug` with early return or redirect if undefined

### Step 9 — Currency/locale configuration (ENHANCEMENT)

**Files:** `apps/web/app/s/[slug]/page.tsx`

- Read locale and currency from `process.env.NEXT_PUBLIC_DEFAULT_LOCALE` and `NEXT_PUBLIC_DEFAULT_CURRENCY` with `en-KE` / `KES` as stable defaults
- This is a single env var change — no new config surface

## Non-goals (explicit)

- **No new features.** No new components, no new routes, no new API endpoints.
- **No rewrites.** The page structure stays exactly as-is. Changes are surgical.
- **No removing M-Pesa** — just making the component correctly show alternatives.
- **No removing the debug onboarding URL** — extracting to shared util is sufficient.

## Verification

1. `pnpm --filter @onpoint/api test` — API route tests pass (existing + new curator tests)
2. `pnpm --filter web test` (or equivalent) — page tests pass
3. `pnpm --filter @repo/agent-core check-types` — no new type errors
4. `pnpm --filter web lint` — no lint errors
5. Manual: load `/s/wanja` in browser, verify page renders with no blank-screen flash
6. Manual: set `checkout: "shopify"` on a curator, verify MpesaPaymentPanel shows redirect button
7. Manual: navigate to storefront without network, verify error.tsx shows retry button

## Files changed

Modified:
- `apps/web/app/s/[slug]/page.tsx` — shared types, extracted api-base, loading/error integration
- `apps/web/app/s/[slug]/MpesaPaymentPanel.tsx` — checkout type branching
- `apps/web/app/s/[slug]/intel/page.tsx` — null-safe params.slug
- `apps/api/routes/curator-admin.js` — pagination params
- `apps/web/app/curator/onboard/page.tsx` — shared api-base import

New:
- `apps/web/app/s/[slug]/error.tsx`
- `apps/web/app/s/[slug]/loading.tsx`
- `apps/web/lib/utils/api-base.ts`
- `apps/api/routes/__tests__/curator-storefront.test.js`
- `apps/web/app/s/[slug]/__tests__/page.test.tsx`
