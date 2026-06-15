# Fix: Live AR camera session — race condition, fallback chain, agent-wallet crash

## Context

The "camera" (Live AR stylist) is failing for the user with:

```
api/ai/live-session:1  Failed to load resource: the server responded with a status of 402 ()
Error: Gemini Live requires payment or your own API key.
    at Object.provisionSession (0d9f~z8ipy_aj.js:95:29362)
```

Root causes (in priority order):

1. **Race condition / stale closure** — `useLiveSession` reads `localStorage.getItem("onpoint_preferred_provider")` as the initial `selectedProvider`. If that's `"gemini"`, every page load picks the **gemini** factory. The "Quick Start" button in `LiveStylistView.tsx:382-388` calls `setSelectedProvider("venice")` then `startSession(...)` **synchronously in the same tick**, so the `factory` captured in `useLiveProvider`'s closure is still the gemini factory. The 402 fires, the user can't recover, and localStorage stays at `"gemini"` forever.

2. **Missing `fallbackChain` implementation** — every factory in `live-session-factories.ts` declares a `fallbackChain: ["replicate", "azure", "0g", "gemini"]`, but `use-live-provider.ts` never references `fallbackChain`. It's dead config. We should walk the chain when a free-tier provider fails, so a transient Venice outage doesn't immediately 402 the user.

3. **agent-core crash on Hetzner** — the server's `lib/agent-core/dist/index.cjs:555` calls `createRequire(undefined)`, crashing `agent-wallet.ts` on module load. This is a separate latent bug that breaks the `onpoint-signer` PM2 process and silently degrades auth (any signed-in user request that touches agent-core will fail). Should be fixed opportunistically since we're already in the file.

The user's mental model ("venice is failing and falling through to gemini") is partially right: Venice is fine, the venice path is just not being used because of (1).

---

## Implementation

### Part 1 — Race condition fix (highest impact, smallest change)

**`apps/web/components/VirtualTryOn/hooks/useLiveSession.ts`** (around line 792):

Add a 4th optional `provider` argument to the local `startSession` wrapper. When provided, it overrides `selectedProvider` for that one call:

```ts
const startSession = useCallback(
  async (
    goal: SessionGoal,
    apiKey?: string,
    persona?: string,
    provider?: AIProvider,
  ) => {
    setSessionGoal(goal);
    if (persona) setSelectedPersona(persona);
    // Provider override wins over the persisted preference so the
    // caller (e.g. Quick Start) can't be trapped on a paid/BYOK
    // provider by stale localStorage.
    await liveProvider.startSession(
      goal ?? undefined,
      apiKey || undefined,
      persona || undefined,
      provider, // pass through; hook will resolve the factory
    );
  },
  [liveProvider.startSession],
);
```

**`packages/ai-client/src/use-live-provider.ts`**:

1. Extract the existing `startSession` body into a private helper `runSession(factory, sessionGoal?, userApiKey?, persona?)`.
2. Make the public `startSession` accept an optional 4th `factoryOverride?: LiveSessionFactory` argument. When set, use that factory; otherwise `factoryRef.current` (already tracked via the existing `factoryRef`).
3. Add `factoryOverride` to the `LiveProviderState` return type only if needed for tests; not required for callers.

This is the minimal change: callers like `useLiveSession.startSession(goal, key, persona, "venice")` now reliably use the venice factory for that call.

**`apps/web/components/VirtualTryOn/LiveStylistView.tsx`** (line 387):

Change:
```ts
startSession("daily", undefined, DEFAULT_LIVE_PERSONA);
```
to:
```ts
startSession("daily", undefined, DEFAULT_LIVE_PERSONA, "venice");
```

And in `onSelectComparisonProvider` (line 393), pass the chosen `p` as the override:
```ts
startSession(g as SessionGoal, undefined, DEFAULT_LIVE_PERSONA, p as AIProvider);
```

### Part 2 — Implement `fallbackChain`

**`packages/ai-client/src/use-live-provider.ts`**:

1. Add an import: `import { SESSION_FACTORIES } from "./providers/live-session-factories";`
2. Add a helper `resolveFallbackChain(primary: LiveSessionFactory, byok: boolean): LiveSessionFactory[]` that returns `[primary, ...primary.fallbackChain?.filter(...)]`, filtering out the gemini factory when `!byok` (since gemini requires payment/BYOK and would just 402 again).
3. Wrap the `factory.provisionSession(...)` call inside `runSession` (and `factory.createSession(...)`) so that if the primary throws, the next factory in the chain is tried. The first one that succeeds wins.
4. Track the **resolved factory** in a local `effectiveFactory` and use it for `provisionSession`, `createSession`, and the existing `endProvisionedSession` (so the `/api/ai/live-session/end` POST uses the right provider name).
5. Make `fallbackChain` opt-in via a flag on the factory (default: ON if `fallbackChain` is non-empty), so individual providers can opt out. Add `disableFallback?: boolean` to the `LiveSessionFactory` interface.

### Part 3 — Agent-wallet crash fix

**`packages/agent-core/src/agent-wallet.ts`** (around line 33-37):

The issue:
```ts
const requireOptionalNative = createRequire(
  (typeof __filename !== "undefined"
    ? `file://${__filename}`
    : (import.meta as ImportMeta).url) as string,
);
```

In tsup's CJS bundle, `__filename` exists as a string (set by tsup), but the `file://` prefix is wrong for `createRequire` on Node ≥ 18 — it expects either a file URL *object*, a `file://` URL *string*, or an absolute **path string** without the `file://` prefix. Passing `file:///path/to/index.cjs` to `createRequire` should work in modern Node, but the tsup-bundled `__filename` value can be undefined inside a chunk that gets re-exported.

Fix: defensively handle the `undefined` case by lazy-initializing on first use with `process.cwd()` fallback, and only call `createRequire` when we actually need it (inside `loadOWS`):

```ts
function getRequireOptionalNative(): NodeRequire {
  if (requireOptionalNative) return requireOptionalNative;
  // tsup CJS bundles sometimes lose __filename in chunk re-exports.
  // Fall back to the current working directory, which is enough for
  // node_modules resolution.
  return createRequire(`${process.cwd()}/`);
}
```

Also, drop the immediate call to `createRequire` at module top level; only construct it lazily. That way module import no longer throws.

**Verification on Hetzner:**

```bash
ssh snel-bot "cd /opt/onpoint/lib/agent-core && node -e 'require(\"./dist/index.cjs\")' 2>&1 | head -20"
```

Should no longer throw `ERR_INVALID_ARG_VALUE`.

### Part 4 — Tests

**Add to `apps/web/components/__tests__/use-live-provider.test.ts`:**

1. Test that `startSession(goal, key, persona, factoryOverride)` uses the override factory even when the hook was initialized with a different one.
2. Test that when primary `provisionSession` throws and `fallbackChain` is set, the next factory in the chain is tried.
3. Test that gemini is filtered out of the fallback chain when no BYOK is provided.

**Add to `apps/web/components/VirtualTryOn/__tests__/LiveStylistView.gate.test.tsx`** (or new file):

1. Test that calling `onStart` on the start screen routes through to the venice factory regardless of `selectedProvider === "gemini"` in localStorage.

---

## Files to modify

| File | Change |
| --- | --- |
| `apps/web/components/VirtualTryOn/hooks/useLiveSession.ts` | Add `provider?` to local `startSession`; pass through |
| `apps/web/components/VirtualTryOn/LiveStylistView.tsx` | Pass `"venice"` (or `p`) as override in `onStart` / `onSelectComparisonProvider` |
| `packages/ai-client/src/use-live-provider.ts` | Extract `runSession`; add `factoryOverride` param; implement `fallbackChain` walker; expose `runSession` indirectly |
| `packages/agent-core/src/agent-wallet.ts` | Lazy-initialize `createRequire`; defensive `undefined` guard |
| `apps/web/components/__tests__/use-live-provider.test.ts` | Add 3 tests: override, fallback chain, BYOK filtering |
| `apps/web/components/VirtualTryOn/__tests__/LiveStylistView.gate.test.tsx` | Add regression test: venice wins regardless of localStorage |

## Verification

1. `pnpm -w test` — all unit tests pass, including the new ones
2. Manual: `cd apps/web && pnpm build` — clean compile
3. Manual smoke test (after deploy):
   - Open `beonpoint.netlify.app` in incognito
   - Click "Start Style Camera" → camera launches, no 402, frames flow
   - DevTools console: `localStorage.setItem("onpoint_preferred_provider", "gemini"); location.reload()` → camera should still work via the fallback chain (or surface the gemini payment modal cleanly, not a crash)
4. Server-side: `ssh snel-bot "pm2 logs onpoint-api --lines 50"` should no longer show `ERR_INVALID_ARG_VALUE` from `agent-wallet.ts` after agent-core rebuild + PM2 restart

## Out of scope

- Refactoring `useLiveProvider` to take a factory *getter* instead of a factory prop (would be cleaner but a bigger refactor; this plan is minimal and targeted)
- Adding analytics for fallback chain hits
- Implementing the actual venice / replicate / azure fallback at the *backend* level (Hetzner) — the free-tier factories all hit different backends already, so client-side chain walking is sufficient
