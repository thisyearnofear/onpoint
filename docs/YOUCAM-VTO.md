# YouCam Apparel Virtual Try-On

OnPoint's **paid agent try-on tier** uses [YouCam API](https://docs.perfectcorp.com) `cloth-v4` when `YOUCAM_API_KEY` is set. This is the only hackathon integration still running in production.

Try-on is not a standalone demo — it sits in front of a payable offer. A garment-conditioned render feeds the fit signal, polaroid artifact, and (for agents) the x402 receipt before checkout.

## Provider chain

| Tier | Who | Chain |
| --- | --- | --- |
| **Paid** | Agents via x402 | YouCam cloth-v4 → Replicate IDM-VTON → Venice |
| **Free** | Web users | Venice SD35 (style approximation, not the actual garment) |

When YouCam fails (bad key, timeout, task error), the engine records `fallbackReason: 'youcam_unavailable'` and falls through to Replicate. The commerce interface (`POST /api/agent/try-on`) is unchanged.

## How it works

1. **File API** — base64/data-URI inputs upload via presigned PUT; public URLs pass through
2. **Task API** — `POST /s2s/v2.0/task/cloth-v4` with person + garment refs and `garment_category`
3. **Poll** — `GET /s2s/v2.0/task/cloth-v4/{task_id}` every 1.5s (120s window) until `task_status: success`
4. **Downstream** — fit analysis runs on the garment-conditioned render; result cached in R2 with provider-aware keys

Category inference (`upper_body`, `lower_body`, `full_body`, `shoes`, `outer`, or `auto`) uses kit type, listing title, and tags.

## Configuration

```bash
# apps/api/.env
YOUCAM_API_KEY=...                          # required
YOUCAM_API_BASE_URL=https://yce-api-01.makeupar.com  # optional
YOUCAM_TIMEOUT_MS=120000                    # optional
```

Key console: https://yce.makeupar.com/api-console/en/api-keys/

## Code & validation

| Component | Path |
| --- | --- |
| YouCam client | `apps/api/lib/youcam-vto.js` |
| Engine wiring | `apps/api/routes/ai-virtual-tryon.js` |
| Agent route | `apps/api/routes/agent-tryon.js` |
| Funnel costs | `apps/api/lib/funnel.js` (`youcam-cloth-v4`) |
| Unit tests | `apps/api/routes/ai-virtual-tryon.test.js` |
| Live smoke test | `scripts/youcam-tryon-smoke.mjs` |

```bash
node scripts/youcam-tryon-smoke.mjs
```

## Demo video

https://youtu.be/Y4u5q9jzlPs

Historical hackathon context: [HACKATHONS.md](./HACKATHONS.md)
