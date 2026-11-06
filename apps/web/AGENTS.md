<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Frontend verification

Run frontend tests from `apps/web` with `./node_modules/.bin/vitest run <test paths>`. Avoid `npx vitest`: it can resolve another workspace's Vitest version instead of the frontend's installed version.

Use `npm run check-types` for the frontend typecheck.

## Frontend design system (consolidated 2026-11-05)

- **Tokens:** `app/globals.css` is the single source — warm paper/ink neutrals (the wardrobe-studio palette), shadcn-compatible HSL triplets. Semantic states (`success/warning/error/info`) are also HSL and consumed via `hsl(var(--*))`. Never reintroduce RGB triplets or hardcoded hex in shared CSS.
- **Typography:** Geist Sans (UI) + Geist Mono + `--font-display` (Georgia serif) for brand headlines via `font-display` / `text-fashion-display`. Smallest type size is `text-xs` (12px); arbitrary `text-[Npx]` below 12px is banned — the mobile floor lifts `text-xs` to 14px under 640px.
- **Persona colors:** never interpolate Tailwind classes (`bg-${color}`). Use `personaStyling.theme.*` from `lib/utils/persona-theme.ts` — literal class maps keyed by color family. Tailwind scans `lib/` and `packages/{shared-ui,ui}`; there is no safelist, so dynamic classes silently break.
- **Motion:** exponential ease-out `cubic-bezier(0.16,1,0.3,1)` — no elastic/bounce easing.
- **Honest metrics:** no hardcoded ratings, counts, or "community favorite" claims. Rating UI renders only when real `averageRating` data exists.
- **Iconography:** Lucide only — no emoji in UI chrome (emoji in generated share captions is fine). Logo is a hairline tile + `Shirt`.
- **Structure:** eyebrows/mono-uppercase labels only for genuinely ordinal or functional labels; left-biased heroes. Root layout is intentionally non-async — do not re-add `auth0.getSession()` there (it forces every page dynamic). Public pages stay prerendered: anything reading live inventory (curator listings, real looks) is fetched **client-side** from the browser — a server fetch on `/` makes the homepage dynamic (`next build` shows it as `ƒ`, not `○`).

## Provider architecture (2026-11-05)

- **Root `Providers` (`app/providers.tsx`) is wallet-free by design.** It holds SWRConfig, Auth0Provider, QueryClientProvider, MiniAppProvider (must stay global — it fires `sdk.actions.ready()` for Farcaster splash), StyleProvider, Toaster, ViewTransitionProvider.
- **Wallet stack is route-scoped.** wagmi/RainbowKit/MiniPay live in `app/wallet-providers.tsx` (`WalletProviders`). A route that calls wagmi/RainbowKit/`useMiniPay` hooks gets them via a `layout.tsx` in its own directory wrapping `<WalletProviders>` — currently `app/(consumer)/lab/layout.tsx` and `app/curator/onboard/layout.tsx`. Do not re-add wagmi to root Providers; do not call wallet hooks on public routes — they will throw outside `WalletProviders`.
- Dead provider note: `@repo/ai-client`'s `AIProviderContext` was removed (zero consumers; `useAIClient` falls back to a mock).

## Product coherence (2026-11-05)

Every surface is one funnel: **try on → get styled/judged → share artifact → purchase**. A feature is coherent only if it produces a try-on, a purchase, or a share artifact — otherwise it's a strand.

- **New surface ≠ new loop.** Features enter through an existing entry point, reuse shipped primitives (render, polaroid/share card, signed token, gift claim, earnings ledger), and exit to purchase. If a feature needs new machinery *and* a new entry point, park it — that's a Frankenstein limb.
- **Build order for the social layer (ADR 0025/0026):** shipped end-to-end — invites (`/try/{token}`) → gift claim (`/gift/{token}`) → couple cards (`/c/{id}`, `/cards`) → wishlists (`/w/{id}`). Every hop logs a funnel event.
- **Entry-point budget (2026-11-06, [ADR 0028](../../docs/adr/0028-navigation-consolidation-places-not-flows.md)):** nav is for **places, not flows**, and there are exactly three — Wardrobe (`/`), Runway (`/runway`), Fitting room (`/lab/try-on`). `lib/navigation.ts`'s `PRIMARY_NAV` is the only source of truth; there is no secondary nav, no "More" popover, no header action pills, no bottom nav and no tab strip under it. A second layer offering the same choice is how the budget gets spent twice. Non-consumer destinations (Supply, Developers, Pricing, Guides, About, Privacy, Terms) live in `FOOTER_LINKS`, rendered by the one shared `OnPointFooter` — one footer, one header, no page-level substitutes. Purchase is an **action on an artifact** (`/s/{curatorSlug}?item={listingId}`), never a place: `/shop` is the house catalog and is entered only by an action, the way `/couple`, `/magazine` and `/cards` are entered by link. New relational/gift flows enter as *options inside the artifact flow* — a "Send as magazine" choice on a share row, not a nav item. When a surface doesn't fit the consumer ICP, move it to `/admin` or cut it.
- **Brochures vs tools:** marketing content ("what we solve", streak counters, G$ unlock ads) belongs on brochure surfaces (`/about`, `/curator`, `/s/{slug}`) — never inside a tool flow. Precedent: lab "Home" dashboard deleted; G$ streak card pulled from the persona picker.
- **Recipient surfaces pattern:** `/try/{token}`, `/gift/{token}`, `/c/{id}`, `/w/{id}` — unguessable-id public pages, no account, no price, one artifact + next-action CTAs that hand off (never dead-end). Exception: `/try/{token}` shows the picked item's price — the ask there is a purchase decision, not a surprise. Invites are single-use at the render seam (a Redis claim keyed to the token hash via `/api/invites`, released if the render fails). A couple card can be delisted from `/cards` by whoever holds the link (`/api/couple/card/:id/report`) — the photographed person's exit. New relational surfaces follow this shape.
- **Carry-forward:** surfaces pass context via `?from=&item=&persona=` deep links into the fitting room; results always offer the next loop (Get it / Try it on / Save / Send it), not a dead end. `from=` names **whose shelf** the garment came from — a curator slug — never an artifact kind; `lib/utils/deep-link-source.ts` is the resolver, and `apps/api/lib/slugs.js` reserves `card|list|mag` so no shelf can take those names. A Get-it door resolves through `lib/utils/get-it.ts` to `/s/{curatorSlug}?item={listingId}`; when no listing is provable it offers `/curators` ("ask a curator who stocks it") — never a disabled CTA, never a bare Shop link. `/pay` is the human front door to the NEAR try-on rail — one optional field (the tx hash), payer chain-derived, MyNearWallet redirect + https QR; listings come from `/api/pay/listings` (the same storefront agents read).
- **Upstream auth:** web proxies that call keyed API endpoints (`/api/ai/*`) must send `x-api-key: process.env.VENICE_API_KEY` — the key lives in fly secrets. Missing it silently 401s (the invite-render incident).
- **Constraints are copy, not chrome:** every constraint the user can feel is named in-line at the point of action — capability links explain themselves ("this link is the list — whoever has it can add pieces"), local state says where it lives ("this device"), terminal states offer a next action ("ask for a fresh one / send one back"), never a bare error.
- **Web/API boundary:** web-side UX tokens (invites, cards) may be stateless, but their artifacts must resolve through the API's own objects (render, order, claim). Don't fork the data model.
- **Resolved duplicates:** `/shop` is the only shop verb (lab `ShopPanel` deleted; `?tab=shop` redirects); lab "Saved" is try-on results (`#your-try-ons`), and `/looks` is the same catalog the outfits tab already shows (308, params preserved) — the composer is `Curator/CuratorLookCreator`, not a browse surface. `/look/[slug]` stays: that is the shareable artifact URL. Different verbs, honest names, one surface each. - **Honest commerce state (2026-11-06):** nothing is purchasable yet — buy CTAs on consumer surfaces resolve to try-on/save/share, never a checkout that can't fulfill. Prices are hidden behind `components/PriceReveal.tsx` ("See price" → KES + ≈local conversion via `lib/fx.ts`); the reveal's currency selector IS the preference (`onpoint-currency` localStorage). Attribution is data-driven: `look.provenance` renders "OnPoint studio" for studio fixtures, "From {slug}" for real curators; `/s/{slug}`, `/shop`, `/curators` carry the demo note (rails real, inventory studio sample stock). Don't reintroduce fake-merchant names or visible prices on studio content.
- A retirement you mean to be **permanent** goes in `next.config.js`'s `redirects()`; only a destination that must carry the query keeps a page calling `permanentRedirect()` — and that page must `await searchParams` and sit *outside* `app/(consumer)`, because the client layout flushes the shell before the page runs and Next can then only answer 200 with a `<meta http-equiv="refresh">`. Verify a redirect against `npm run build` + `npm run start`: a test can lock the table, only the running server proves the status.

## Surface primitives (2026 design consolidation)

- `components/surface/`: `ArtifactShell` (thin header + eyebrow→artifact→title + safe-area `stickyAction`), `ItemRow` (56px thumb, 44px buttons, try-on/get-it via `lib/utils/get-it.ts`), `MoreRail` (mobile snap-scroll → 4-col), `ExitLinks` (reply/couple/make/magazine/board), `FactList` (hairline definition list, `shortHash` for mono tappable hashes), `Section` (brochure rhythm).
- `components/guides/GuideLayout.tsx` — the one chrome for all `/guides/*` (eyebrow, font-display title, lede, hairline takeaway list). Guides supply content only.
- `/pricing` 308s to `/developers#pricing` — pricing content lives as a section there (agents are the audience).
- `ShareArtifact` is the one share row; `onShare(channel, url, sid)` is the hook for funnel events (see `LookShareButton`). ShareKit survives only on `/curator/onboard`.
- ESLint bans (fire as warnings via `eslint-plugin-only-warn`): `rounded-3xl`, `shadow-2xl`, `bg-gradient-to-*`, `text-(emerald|amber|indigo|purple)-\d`, decorative `Sparkles` — under `app/` outside `/admin`.
- Review rule: ≤2 levels of bordered-box nesting per surface.

## State vocabulary (2026-11-06)

Surfaces were consolidated first; states are the second dialect. Every wait, empty, error, and win goes through `components/state/` — never hand-roll them:

- `<Spinner size tone>` — the one border-spinner (`sm|md|lg|xl`, `default|inverse`). Lucide `Loader2 animate-spin` is acceptable for icon-only spins; the border-div pattern is banned outside `components/state/` (ESLint `no-restricted-syntax`, app + components).
- `<Busy label>` — inline "verb-ing…" for waits under ~5s (buttons, rows, quality checks). Pass the bare gerund phrase; the ellipsis is added.
- `<StagedWait title stages lines media>` — the one long-wait pattern (>5s, typically 30–120s generations): elapsed timer, timer-paced stages, asymptotic progress capped below 100%, rotating honest notes. Stage `at` times should reflect measured upstream durations, not guesses.
- `<Skeleton className pulse>` — the one placeholder block; compose into layout-matched skeletons (PanelSkeleton, AnalysisSkeleton, CommunitySkeleton, route `loading.tsx` files). Don't hand-roll `animate-pulse` divs.
- `<EmptyState icon title body action>` — name the absence, hand over the next action. Never a dead screen.
- `<ErrorState title message tone onDismiss onRetry actions>` — what happened + it's not your fault + the next move. `tone="warning"` for degraded-but-usable.
- `celebrate(kind)` — confetti budgeted once-per-kind per browser (localStorage). Only for firsts and closed loops (first save, first purchase, gift claimed) — never for loading, never twice.
- Toasts: `components/toast.tsx` (`useToast` inside the root `Toaster`) is the one transient-notification channel — `toast(message, type, { durationMs, action })` accepts ReactNode and an inline action. Rich actionable cards (`AgentSuggestionToast`) and inline undo rows (`UndoToast`) are not toasts — they stay components.

Copy rules: present-progressive labels ("Reading your photo…"), no fake precision ("Step 3/4" that never moves), no apology spam, mixed `...`/`…` is banned — Busy/StagedWait own the punctuation.
