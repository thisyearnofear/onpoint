# ADR 0003 — Storage Strategy (Neon + R2 + Lighthouse)

- **Status:** Proposed — 2026-05-28
- **Date:** 2026-05-28
- **Deciders:** OnPoint core
- **Supersedes:** —
- **Related:** [ADR 0001 — Backend-First Autonomy](./0001-backend-first-autonomy.md), [ADR 0002 — Curator Primitive](./0002-curator-primitive.md), [ARCHITECTURE.md](../ARCHITECTURE.md), [ROADMAP.md](../ROADMAP.md)

## Context

Phase 11 (Curator Storefronts) introduces three new persistence needs that today's stack does not cleanly serve:

1. **Structured Curator data** — `curators`, `kit_skus`, `listings`, `orders`, `sessions` with relations and filterable reads ("Wanja's live inventory", "what sold this week"). Redis is the only DB on the agent's home (Hetzner snel-bot) today; it's a cache, not a relational store.
2. **Mutable product imagery** — Curators (especially sole traders like Wanja) upload jersey photos via WhatsApp that **must** be re-hosted (Meta media URLs expire ~30 days, require auth) and that they will re-shoot regularly. They are on the storefront critical path, so latency matters.
3. **Verifiable agent records** — already solved by [Lighthouse/IPFS](../FEATURES.md#verifiable-agent-logs) for receipts; this ADR keeps that unchanged.

The temptation to use decentralized storage (e.g. [Lens Grove](https://lens.xyz/docs/storage)) for *all* images was considered and rejected — see "Alternatives Considered".

## Decision

Adopt a **three-store split**, each store doing one job:

| Store | Role | Hosts | Why |
|---|---|---|---|
| **Neon (Postgres)** | Structured data — Curators, SKUs, listings, orders, sessions | Managed (serverless), reached from Hetzner over TLS | Relations + filterable reads. Branching per Curator onboarding. Drizzle-compatible. |
| **Cloudflare R2 + Images** | Mutable bytes — product photos, polaroids, share assets, PL kit references | Cloudflare, reached from Hetzner | Zero egress, on-the-fly transforms, prefix-keyed per Curator. |
| **Lighthouse (IPFS/Filecoin)** | Verifiable records — agent receipts, cross-Curator attribution | Existing, unchanged | Already integrated; appropriate when content-addressing + immutability are the point. |

All three are reached from the **Hetzner agent home** (`snel-bot`, per ADR 0001). Vercel/Netlify acts as the thin presentation layer and forwards to Hetzner; no direct DB or object-store credentials live on the edge.

### Operating principles

1. **Structure goes in Postgres, bytes go in R2, verifiable claims go in IPFS.** Never mix.
2. **R2 keys, not URLs, are stored in Postgres.** Keeps the app portable; URL construction lives in one place.
3. **The Hetzner agent is the only writer.** Vercel/Netlify reads via the agent's API. No direct client → R2 uploads except via signed URLs minted by the agent.
4. **WhatsApp ingest is a first-class agent tool.** Media is downloaded from Meta and persisted to R2 within the agent's request loop — never trusted to remain at Meta's URL.

## Target Architecture

```diagram
╭──────────────────────────────────────────────────────────────╮
│  Vercel / Netlify (presentation)                              │
│  Reads via Hetzner API. No DB / object-store credentials.    │
╰────────────────────────────┬─────────────────────────────────╯
                             │
╭────────────────────────────▼─────────────────────────────────╮
│  Hetzner snel-bot (the agent's home — ADR 0001)              │
│  ╭────────────────────────────────────────────────────────╮  │
│  │ onpoint-api      Express, /api/agent/*  /api/ai/*      │  │
│  │ onpoint-worker   BullMQ, schedules, WhatsApp ingest    │  │
│  │ onpoint-signer   Loopback signer (existing)            │  │
│  ╰────────────────────────────────────────────────────────╯  │
│           │            │                │           │         │
╰───────────┼────────────┼────────────────┼───────────┼─────────╯
            │            │                │           │
       Upstash       Neon            R2 + Images   Lighthouse
        Redis      (Postgres)       (Cloudflare)   (IPFS)
        cache /    structure         bytes        verifiable
        memory                                    receipts
```

## Schema (Neon, v1)

```sql
create table curators (
  slug text primary key,
  name text not null,
  type text not null check (type in ('human','ai')),
  channels jsonb not null default '{}',     -- {whatsapp, telegram, instagram}
  brand jsonb not null default '{}',         -- optional for sole traders
  commerce jsonb not null default '{}',
  created_at timestamptz default now()
);

create table kit_skus (
  id text primary key,                       -- "arsenal-2425-home"
  club text not null,
  season text not null,
  kit_type text not null check (kit_type in ('home','away','third','goalkeeper')),
  official_image_key text,                   -- R2 key, nullable
  crest_key text
);

create table listings (
  id uuid primary key default gen_random_uuid(),
  curator_slug text references curators(slug) on delete cascade,
  sku_id text references kit_skus(id),
  sizes jsonb not null,                      -- [{size,stock,price}]
  photo_keys text[] not null default '{}',   -- R2 keys; override official
  status text not null default 'live',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  curator_slug text references curators(slug),
  listing_id uuid references listings(id),
  size text not null,
  customer_phone text,
  source text not null,                      -- 'whatsapp_deeplink' | 'site_buy'
  status text not null default 'pending',
  created_at timestamptz default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  curator_slug text references curators(slug),
  visitor_hash text,                         -- analytics, no PII
  try_on_image_key text,
  polaroid_key text,
  shared boolean default false,
  created_at timestamptz default now()
);
```

## R2 layout

```
/kits/{sku-id}.jpg                              ← PL reference images (shared)
/kits/{sku-id}/crest.png
/curators/{slug}/listings/{listing-id}/{n}.jpg  ← Curator's own photos
/curators/{slug}/polaroids/{session-id}.jpg     ← Customer-generated shares
/curators/{slug}/avatars/main.jpg               ← Optional brand asset
```

Prefix-keyed by Curator → per-Curator delete/backup is `rclone delete r2:onpoint/curators/{slug}/`.

## WhatsApp ingest flow

```diagram
Wanja sends jersey photo ─→ WhatsApp Cloud webhook ─→ Hetzner onpoint-api
                                                            │
                                                            ▼
                                              fetch via Meta API + token
                                                            │
                                                            ▼
                                              put to R2 with deterministic key
                                                            │
                                                            ▼
                                              insert/update Neon listing row
                                                            │
                                                            ▼
                                              agent replies "live at /s/wanja"
```

This pipeline is a tool the Spectrum-ts agent invokes; it is not optional plumbing. Meta media must be downloaded synchronously within the webhook's grace window.

## Alignment with Core Principles

| Principle | Application |
|---|---|
| **ENHANCEMENT FIRST** | Existing Lighthouse/IPFS for receipts is kept; we only add stores where Redis cannot serve the new need. |
| **AGGRESSIVE CONSOLIDATION** | One DB for structure (Neon), one bucket for bytes (R2), one chain-of-custody for verifiable records (Lighthouse). No second DB, no second object store. |
| **PREVENT BLOAT** | Lens Grove is explicitly rejected for product images despite the appeal of staying on-chain — wrong tool, would add an entire signing path for no user benefit. |
| **DRY** | R2 keys live in Postgres only. URL construction is in one helper. WhatsApp ingest is one tool used wherever media arrives. |
| **CLEAN** | Hetzner is the only writer. Vercel reads via API. The (Hetzner → Neon, Hetzner → R2, Hetzner → Lighthouse) seam is the only data perimeter. |
| **MODULAR** | Each store is swappable in isolation (Neon → Turso/RDS, R2 → S3/Blob) without touching the other two. |
| **PERFORMANT** | R2 + Cloudflare Images keeps storefront images <100 ms p95. Postgres reads scoped by `curator_slug` index. Redis remains the hot cache. |
| **ORGANIZED** | R2 layout mirrors Curator domain model. Schema names match Curator schema in ADR 0002. |

## Alternatives Considered

### Lens Storage (Grove) for product imagery — rejected
Grove is excellent for content-addressed, verifiable, public artifacts. It is the wrong tool for Wanja's case because:
- Default immutability conflicts with "she'll re-shoot the Spurs kit on Friday."
- Writes require a Lens account / signer — adding a wallet flow for a sole trader violates the design constraint from her WhatsApp-native onboarding.
- Latency via gateway is 5–10× R2 + CDN on the storefront critical path.
- The verifiability story is already covered by Lighthouse for the records that need it (agent receipts).

We may revisit Grove for **customer-owned polaroids** in a future phase if attribution / portability becomes a feature request.

### Turso (libSQL) instead of Neon — rejected for v1
Turso shines at edge-read-heavy workloads with eventual writes. Wanja's case is write-light, query-rich, and centralized to Hetzner — Postgres's relational features and Neon's branching outweigh Turso's edge model here. We will reconsider if storefront read volume justifies edge replication.

### Vercel Blob or S3 instead of R2 — rejected
- Vercel Blob: pricier and ties more data to Vercel; ADR 0001 has us moving *off* Vercel for stateful work.
- S3: fine but charges egress. R2's zero-egress model dominates on a CDN-fronted, image-heavy storefront.

### Putting bytes in Postgres (`bytea`) — rejected
Inflates row size, kills query performance, breaks CDN caching. Standard wisdom.

## Consequences

### Positive
- Three stores, three roles, clear ownership. CLEAN and ORGANIZED.
- WhatsApp ingest pipeline becomes a reusable tool for any future channel (Telegram, iMessage via Spectrum-ts).
- Per-Curator backup, delete, and migration are one-command operations.
- Zero new credentials at the edge — Vercel/Netlify stays read-only on data.

### Negative / Risks
- Operational: Neon + R2 are two more dashboards to monitor. Mitigated by keeping the agent as the only writer and capturing all errors through existing Sentry integration.
- WhatsApp media expiry: forgetting the ingest step would silently break listings in a month. Mitigated by writing the ingest as the *first* tool the Spectrum-ts agent invokes on any inbound media, with E2E test.
- Cost discipline: R2 storage cost grows linearly with Curators. Set per-Curator storage budgets + alerting before onboarding Curator #5.

## Migration / Sequencing

Folded into Phase 11 Wks 1–2 in [ROADMAP.md](../ROADMAP.md):

1. Provision Neon project + R2 bucket; add secrets to Hetzner via `scripts/setup-secrets.sh` (per ADR 0001).
2. `packages/db/` — Drizzle schema + migrations for the five tables above.
3. `packages/storage/` — R2 client with `put(key, bytes)`, `signedReadUrl(key)`, `transformUrl(key, opts)` helpers.
4. WhatsApp ingest tool wired into the Spectrum-ts agent server (running on Hetzner under PM2).
5. Backfill Wanja's first 10 SKUs from her existing WhatsApp catalog.

## Out of Scope

- Public read access to R2 without CDN front (always go through Cloudflare Images for transforms + caching).
- Storing PII (customer addresses, phone numbers beyond order context) — that's a separate ADR if it ever becomes needed.
- Multi-region Neon replication (single region is fine until storefront p95 latency demands it).
- Moving any of the three stores onto Hetzner itself (cost/ops not worth it until volume justifies it).

## Open Questions

- **ORM**: Drizzle (recommended — SQL-first, lightweight, Neon-friendly) vs. Prisma (heavier, more ergonomic). Default to Drizzle unless team prefers Prisma's DX.
- **Image-transform path**: Cloudflare Images vs. self-hosted via Hetzner + Sharp. Default to Cloudflare Images for v1; revisit if cost spikes.
- **Schema migration tooling**: Drizzle Kit vs. external (Atlas, sqlc-style). Default to Drizzle Kit.

---

## Addendum: Digital Garment Images (2026-07-07)

Digital curator garment images (AI-generated via Venice SD35) are served
from the Hetzner server's static directory (`/opt/onpoint/shared/api/
public/digital-garments/`) at `https://api.onpoint.famile.xyz/
digital-garments/{id}.webp`, not from R2.

Rationale: R2 env vars are not yet configured on the server, and digital
garment images are small (~50KB webp each) with no need for CDN
transforms. The shared directory survives releases via symlink. When R2
is configured, these images can be migrated to R2 with the
`curators/{slug}/listings/{listing-id}/1.webp` key layout.
