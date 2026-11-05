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
- **Structure:** eyebrows/mono-uppercase labels only for genuinely ordinal or functional labels; left-biased heroes. Root layout is intentionally non-async — do not re-add `auth0.getSession()` there (it forces every page dynamic).

## Provider architecture (2026-11-05)

- **Root `Providers` (`app/providers.tsx`) is wallet-free by design.** It holds SWRConfig, Auth0Provider, QueryClientProvider, MiniAppProvider (must stay global — it fires `sdk.actions.ready()` for Farcaster splash), StyleProvider, Toaster, ViewTransitionProvider.
- **Wallet stack is route-scoped.** wagmi/RainbowKit/MiniPay live in `app/wallet-providers.tsx` (`WalletProviders`). A route that calls wagmi/RainbowKit/`useMiniPay` hooks gets them via a `layout.tsx` in its own directory wrapping `<WalletProviders>` — currently `app/(consumer)/lab/layout.tsx` and `app/curator/onboard/layout.tsx`. Do not re-add wagmi to root Providers; do not call wallet hooks on public routes — they will throw outside `WalletProviders`.
- Dead provider note: `@repo/ai-client`'s `AIProviderContext` was removed (zero consumers; `useAIClient` falls back to a mock).
