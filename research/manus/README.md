# Manus Research — Design Intelligence

Durable research assets generated with the Manus API (time-boxed, unlimited
credits). The point is **permanent evidence that informs permanent design work**,
not a running dependency. Re-run `scripts/manus-research.mjs` whenever you want a
fresh snapshot.

## What's here

Each run lands in `run-YYYYMMDD-HHMMSS/`:

| Folder | Contents |
|--------|----------|
| `teardowns/` | One JSON per competitor: onboarding, what the try-on actually renders (garment vs. approximation), pricing, checkout rails, agent API, mobile UX, and the gap vs. OnPoint. `task_url` links to the Manus webapp session with full screenshots. |
| `patterns/` | Best-practice pattern boards for the three hardest design problems (honest approximation labeling, honest social proof, try-on → purchase expectation-setting). |
| `sku-expansion/` | African digital-fashion SKU expansion concepts (motif × garment × occasion) to keep Nia Digital's catalog fresh and varied. |
| `INDEX.md` | Human-readable summary with links. |
| `raw/` | Raw Manus task message logs (for audit). |

## Re-running (keep collections fresh)

```bash
node scripts/manus-research.mjs                # full run (teardowns + patterns + SKU)
node scripts/manus-research.mjs --only teardowns
node scripts/manus-research.mjs --only patterns
node scripts/manus-research.mjs --only sku
node scripts/manus-research.mjs --profile manus-1.6-lite   # cheaper profile
```

Requires `MANUS_API_KEY` in the repo-root `.env.local`.
