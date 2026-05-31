# ADR 0002 — Curator Primitive & Stylist Storefronts

- **Status:** Proposed — 2026-05-28 (amended 2026-05-28 for Wanja / chat-ops admin)
- **Date:** 2026-05-28
- **Deciders:** OnPoint core
- **Supersedes:** —
- **Related:** [ADR 0001](./0001-backend-first-autonomy.md), [ADR 0003 — Storage Strategy](./0003-storage-strategy.md), [ARCHITECTURE.md](../ARCHITECTURE.md), [ROADMAP.md](../ROADMAP.md), [FEATURES.md](../FEATURES.md)

## Context

OnPoint has shipped three overlapping products inside one repo:

1. A **consumer AI stylist** (`sees → judges → shops`) as the public hero.
2. A **web3 agent demo** (ERC-8004, Self Protocol, autonomous executor, multi-chain wallet, IPFS receipts) — the bulk of recent ROADMAP phases.
3. A **creator/social toolkit** (`PolaroidGallery`, `DesignStudio`, `collage`, `SessionEndingCard`, Farcaster share) — built but scattered across the seven-tab `TacticalDashboard`.

Field feedback from a first real merchant prospect (a stylist who sells football jerseys and wants a toolkit for *her* customers) exposed the underlying mismatch: the most distinctive parts of the product (try-on, polaroid, share, AI critique) already exist, but they are buried behind a generic dashboard wrapped in agent/crypto language a fan buying a jersey will never care about.

At the same time, the AI stylist personas (Miranda, Edina, Tan, etc. in `lib/utils/persona-config.ts`) have no structural relationship to the would-be human curators, despite playing the same role in the product: *a voice with a catalog and a point of view*.

We need a single primitive that lets human curators and AI personas coexist, share the same surface, and reinforce each other's loops — without forking the codebase into two products.

## Decision

Adopt a single primitive — the **Curator** — and reframe the product around it. A Curator is anyone (human or AI) with a name, a voice, a catalog, and a point of view. Both Mo-the-jersey-stylist and Miranda-the-AI-persona are Curators differing only in `type`.

Build one new consumer surface, `/s/[slug]`, that composes existing components (`VirtualTryOn`, `PolaroidGallery`, `SessionEndingCard`, `collage`) into a branded storefront scoped to a single Curator's catalog. AI Curators appear inside human Curator storefronts as optional "second opinion" voices.

The agent layer (wallets, autonomous executor, ERC-8004, Token Vault) is **not removed**. It is repositioned as the infrastructure that lets AI Curators transact across human Curator catalogs safely — which is the cleaner story it always wanted to tell.

### Operating principles

1. **One primitive, two types.** `Curator { type: "human" | "ai", catalog, voice, brand }` is the single source of truth. Persona config becomes a seed of AI Curators; merchant config becomes a seed of human Curators.
2. **Storefronts are compositions, not new screens.** `/s/[slug]` reuses shipped components; no new try-on, no new gallery, no new share pipeline.
3. **AI is the sidekick on a human storefront, the host on an AI storefront.** Same components, different default Curator.
4. **The agent layer becomes infrastructure, not the hero.** It moves behind `/lab` and powers cross-Curator attribution, revshare splits, and AI-initiated purchases.
5. **No new auth surface for end customers.** A fan buying a jersey on `/s/mo` must not see a wallet prompt or an Auth0 dialog before their first try-on.

### Human Curator operating system

Wanja's first-demo feedback clarified the human side of the primitive: a Curator does not need a prettier CMS; she needs faster commerce operations on the phone she already uses.

Reusable human-Curator capabilities:

- Inventory controls: one-tap availability, sizes, variant stock, vertical-specific options (for Wanja: plain vs printed jersey, name, number).
- Local checkout: payment profile per Curator; M-Pesa is first-class for Kenya, with manual confirmation before full STK/Daraja integration.
- Delivery handoff: secure delivery details, pickup contact, courier method (for Wanja: Bolt Send flow).
- Notifications: views, time spent, try-ons, brief sends, payments, receipts, delivery updates.
- Template replies: reusable WhatsApp/Spectrum snippets for availability, sizing, printing, payment, delivery, and out-of-stock alternatives.

These are **capabilities**, not Wanja-specific screens. Sportswear, vintage, occasionwear, beauty, footwear, and tailoring can each define their own variant fields and reply templates while sharing the same Curator, listing, lead, and storefront loop.

## Schema

A single TypeScript type, lives in `packages/shared-types`. The schema is intentionally **mostly optional** so a sole trader like Wanja (no logo, no brand book) onboards without friction; defaults are provided by the storefront renderer.

```ts
export type CuratorType = "human" | "ai";

export interface Curator {
  slug: string;                       // /s/{slug}
  name: string;
  type: CuratorType;
  avatar?: string;
  voice?: string;                     // prompt seed for AI; bio sample for humans
  verticals: string[];                // ["football", "streetwear", ...]
  collaborators?: string[];           // other Curator slugs

  // Inbound/outbound channels — Wanja-driven addition.
  // The admin surface for a human Curator is a chat (Spectrum-ts), not a CMS.
  channels?: {
    whatsapp?: string;                // E.164, e.g. "+254712345678"
    telegram?: string;
    instagram?: string;
  };

  // All fields optional for sole traders; renderer supplies tasteful defaults.
  brand?: {
    logo?: string;
    colors?: { primary?: string; accent?: string };
    frameTemplate?: string;           // polaroid frame id
    shareCopy?: string;               // template w/ {team}, {curator}
    location?: { city: string; landmark?: string };
  };

  commerce?: {
    checkout: "whatsapp" | "shopify" | "stripe";
    checkoutUrl?: string;             // for shopify / stripe
    whatsappTemplate?: string;        // prefill for wa.me deep link
    revShare?: number;                // 0..1 of attributed sales
  };
}
```

**Per-Curator inventory does not live in the Curator object.** It lives in [`listings`](./0003-storage-strategy.md#schema-neon-v1) in Neon, joined to a shared `kit_skus` table (the Premier League backbone — clubs × seasons × kit types). This means Wanja types "+ arsenal home M 2500 4" into WhatsApp and the agent creates a row referencing the SKU, instead of forcing her to author a product description.

Both [`persona-config.ts`](../../apps/web/lib/utils/persona-config.ts) entries and new human-Curator entries serialize to the `Curator` shape. `persona-config.ts` becomes the loader for `type: "ai"` Curators; `apps/web/config/curators/*.json` seeds `type: "human"` Curators for v1, with Neon as the source of truth once self-serve onboarding ships.

## Chat-ops admin surface

A sole-trader Curator should never see a CMS. Her admin surface is **a conversation** with the OnPoint agent on the channel she already uses (WhatsApp first, via [Spectrum-ts](https://photon.codes/docs/spectrum-ts/introduction); Telegram + iMessage as additional providers under the same agent loop).

> **Number provisioning**: The agent's WhatsApp number is provisioned through Twilio (a virtual SMS-capable number, ~$1–2/mo). This number is then registered with Meta's WhatsApp Business Cloud API as the business line. Spectrum-ts connects to this registered number using Meta-provided credentials (`accessToken`, `phoneNumberId`, `appSecret`). The Curator (Wanja) never touches any of this — she texts our agent's number from her personal WhatsApp, same as texting anyone.

Minimum command set for v1 (Wanja):

| Command | Effect |
|---|---|
| `+ <club> <type> <size> <price> <qty>` + 📷 | Create listing; ingest photo to R2; reply with `/s/{slug}/{listing-id}` |
| `- <club> <type> <size>` | Decrement stock; auto-pause listing when 0 |
| `stock` | Reply with live listings + stock counts |
| `link <club> <type>` | Reply with short URL to share with a customer |
| `help` | Menu |

The agent runs on Hetzner under PM2 (per [ADR 0001](./0001-backend-first-autonomy.md)), using `@repo/agent-core` for tools and Spectrum-ts for the messaging plumbing. Customer-facing storefront stays on Vercel/Netlify and reads via the Hetzner API.

> **Operational note**: WhatsApp Business Cloud API has a ~24h customer-initiated session window for free-form replies; agent-initiated outbound (e.g. "Liverpool home is low stock") requires pre-approved Meta templates. Treat template approval as part of Wanja's onboarding, not an afterthought.

## Target Surface

```diagram
╭──────────────────────────────────────────────────────────────╮
│                  LAYER 3 — The Loop                          │
│  Try-on → Polaroid → Share → Buy → Memory → Re-engage        │
│  (existing components, recomposed under /s/[slug])           │
╰────────────────────────────┬─────────────────────────────────╯
                             ▲
╭────────────────────────────┴─────────────────────────────────╮
│                  LAYER 2 — The Cast (Curators)               │
│   Human Curators           ┊      AI Curators                │
│   (Mo, sneaker plug,       ┊      (Miranda, Edina, Tan…)     │
│    Ankara tailor…)         ┊      from persona-config        │
│   from curators/*.json     ┊                                 │
╰────────────────────────────┬─────────────────────────────────╯
                             ▲
╭────────────────────────────┴─────────────────────────────────╮
│                  LAYER 1 — The Engine                        │
│  Vision, try-on, persistence, payments, agent receipts,      │
│  ERC-8004 attribution (now: cross-Curator infrastructure)    │
╰──────────────────────────────────────────────────────────────╯
```

## Alignment with Core Principles

| Principle | Application |
|---|---|
| **ENHANCEMENT FIRST** | No new try-on, gallery, share, or collage components. `/s/[slug]` is a route that composes shipped ones. |
| **AGGRESSIVE CONSOLIDATION** | `persona-config.ts` and the implicit "merchant" concept collapse into one `Curator` schema. The global `CATALOG` in [`storefront/route.ts`](../../apps/web/app/api/agent/storefront/route.ts) is deleted in favor of per-Curator catalogs. |
| **PREVENT BLOAT** | Hard rule: no new feature ships unless a named Curator asked for it and a named customer of theirs will use it next week. ROADMAP phases not serving the Curator loop move to `/lab`. |
| **DRY** | One Curator schema feeds the storefront, the AI persona picker, share-card branding, and revshare attribution. |
| **CLEAN** | Layer 1 (engine) / Layer 2 (Curators) / Layer 3 (loop) is the only architectural seam end-to-end. Agent/web3 code is fenced behind `/lab` and `/api/agent/*`. |
| **MODULAR** | A Curator is a self-contained config object. Storefronts render purely from it. AI Curators are swappable into any human Curator's storefront. |
| **PERFORMANT** | `/s/[slug]` is statically renderable per Curator; catalogs are scoped (no global product load). Existing thumbnail compression in [`PolaroidGallery`](../../apps/web/components/PolaroidGallery.tsx) handles share assets. |
| **ORGANIZED** | New files only where the schema demands: `packages/shared-types/curator.ts`, `apps/web/config/curators/*.json`, `apps/web/app/s/[slug]/page.tsx`. No new top-level domain. |

## Consequences

### Positive
- One product story instead of three. Distribution comes from Curators' existing audiences, not paid acquisition.
- The agent layer gets a real use case (cross-Curator attribution + AI-initiated purchases) instead of being a hero feature nobody asked for.
- AI personas become more valuable (they can appear in every Curator's storefront) without new model work.
- Share assets (polaroids, fit-check cards) become the growth loop — every fan share is an ad for the next Curator.

### Negative / Risks
- Marketplace cold start: needs ~5 curators across distinct verticals before the cross-recommendation graph has value. Mitigation: concierge onboarding of the first 5; AI Curators can populate empty verticals until a human curator joins.
- Vocabulary clash: today "stylist" means both AI persona and human merchant. Rename in copy: AI → **Stylist (persona)**, human → **Curator** or **Shop**. Code uses `Curator` throughout.
- Refactor pressure on [`persona-config.ts`](../../apps/web/lib/utils/persona-config.ts), [`storefront/route.ts`](../../apps/web/app/api/agent/storefront/route.ts), and [`TacticalDashboard.tsx`](../../apps/web/components/Dashboard/TacticalDashboard.tsx) to consume the new schema. Done in one pass, not piecemeal.
- ROADMAP phases that don't serve the Curator loop (multi-chain expansion, agent-to-agent economy, custom persona training) drop priority. They are not deleted; they move to `Post-MVP` until evidence justifies them.

## Migration / Sequencing

See [ROADMAP.md → Phase 11](../ROADMAP.md) for the 12-week sequence. Summary:

1. **Wks 1–2** — Schema + `/s/[slug]` + Mo as first Curator. No AI sidekick yet.
2. **Wks 3–4** — Share-asset templates (3) production-grade with watermark.
3. **Wks 5–6** — AI Curators wired in as "second opinion" on `/s/mo`.
4. **Wks 7–8** — 4 more Curators in distinct verticals (sneakers, Ankara, hair, vintage).
5. **Wks 9–10** — Cross-Curator graph: AI recommends across all human catalogs with attribution.
6. **Wks 11–12** — Measure the share → visit → try-on → purchase funnel per Curator; decide pricing model.

## Out of Scope (explicit)

- Building a new try-on, gallery, or share component.
- Public Curator directory / marketplace UI (deferred until ≥10 Curators exist).
- Crypto-native checkout for end customers (off-ramp to each Curator's existing checkout — Shopify / WhatsApp / Stripe).
- Removing the agent / ERC-8004 / Token Vault stack. It moves behind `/lab` and becomes attribution + AI-purchase infrastructure.

## Open Questions

- **Pricing model**: SaaS to Curator, revshare on attributed sales, or premium-AI-session split? Decide after Phase 11 measurement.
- **Where Curator configs live**: flat `apps/web/config/curators/*.json` for v1, Redis-backed for v2. ADR open until self-serve Curator signup is required.
- **AI Curator catalog source**: do AI Curators have their own catalog, or do they recommend across the union of human Curator catalogs? Default: union, scoped by the human Curator hosting them.
