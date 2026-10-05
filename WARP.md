# WARP.md

Guidance for WARP (warp.dev) in this repository.

OnPoint is a pnpm/Turborepo monorepo — agentic fashion commerce: branded curator storefronts, AI try-on, and an x402 agent commerce rail on Celo.

## Commands

```bash
pnpm install          # install dependencies
pnpm dev              # all apps (web on :3000)
pnpm build            # build all workspaces
pnpm lint             # ESLint
pnpm check-types      # TypeScript
pnpm format           # Prettier
pnpm --filter @onpoint/api test   # API tests (hermetic, no live DB)
pnpm deploy:api       # deploy API to Hetzner
```

## Doc map

- [README.md](./README.md) — pitch + entry points
- [AGENTS.md](./AGENTS.md) — agent-facing API reference (canonical for commerce endpoints)
- [docs/STRATEGY.md](./docs/STRATEGY.md) — canonical positioning, phases, metrics
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — system shape and data flow
- [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md) — env vars, setup, deployment
- [docs/guides/](./docs/guides/) — external how-tos (agent commerce, referrals)
- [docs/ops/](./docs/ops/) — internal runbooks (Hetzner, monitoring, audits)
- [docs/adr/](./docs/adr/) — architecture decision records

## Conventions

- Node 22+, pnpm 10. Workspaces: `apps/*`, `packages/*`.
- API tests are hermetic by default; `LINQ_MOCK=1` is test-only, never set in production.
- Enhancement first; delete don't deprecate (see `docs/ops/phase1-audit.md`).
