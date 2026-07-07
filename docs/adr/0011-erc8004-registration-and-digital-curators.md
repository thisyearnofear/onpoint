# ADR 0011: ERC-8004 Registration & Digital Curators

**Status**: Accepted  
**Date**: 2026-07-07

## Context

OnPoint's agent is registered on the Celo ERC-8004 Agent Registry. This ADR
records the registration details (previously only in code) and introduces
**digital curators** — AI curators whose catalog is generated digital fashion,
not physical inventory — as a new product surface for the Celo Agentic
Payments & DeFAI Hackathon (July 7–20, 2026).

## ERC-8004 Agent Registration

The OnPoint AI Stylist is registered on-chain at the Celo Agent Registry.

| Field | Value |
|-------|-------|
| Agent ID | `9177` |
| Agent name | OnPoint AI Stylist |
| Wallet address | `0x5b33E63440e95289207120B94da78CE22F9D24fB` |
| Registry contract | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Registration tx | `0x536940e8b9167776a7e2951c9f427ee0a519736f4470cf10065e127b0d14abe3` |
| Block | 67,852,981 |
| Registered at | 2026-05-25T23:57:00Z |
| Agent metadata URI | `https://beonpoint.netlify.app/.well-known/agent.json` |

The registration transaction called `registerAgent` on the registry contract,
minting agent ID 9177 and storing the agent.json URL as the metadata pointer.
The tx is confirmed with 3.6M+ confirmations on Celo mainnet.

**Verification**:  
- Celoscan: https://celoscan.io/tx/0x536940e8b9167776a7e2951c9f427ee0a519736f4470cf10065e127b0d14abe3
- 8004scan: agent ID 9177 at the registry address above

The agent records verifiable receipts for every action (purchase, try-on, mint,
tip) to IPFS/Filecoin and optionally anchors them on Celo via memo transactions.
See `packages/agent-core/src/agent-registry.ts` for the implementation.

## ERC-8021 Attribution Tags

All platform-initiated cUSD transfers carry an ERC-8021 attribution tag in the
transaction calldata, derived from the API hostname:

| Field | Value |
|-------|-------|
| Attribution code | `celo_aac2acfa60e8` |
| Derived from | `api.onpoint.famile.xyz` |
| SDK | `@celo/attribution-tags@0.3.0` |
| Module | `apps/api/lib/attribution.js` |

Every 402 response (order + try-on) includes the attribution code and dataSuffix
so paying agents can optionally tag their own payment transactions. All
platform payout transfers (curator payouts, retry payouts) carry the suffix
automatically via `TransferParams.dataSuffix` in `packages/agent-core/src/erc20.ts`.

## Digital Curators

### Concept

A **digital curator** is an AI curator whose catalog consists of **digital
garments** — AI-generated fashion designs that exist only as rendered images.
External agents can:

1. **Browse** the digital catalog (free, via the existing directory + storefront endpoints)
2. **Try on** a digital garment on their human (x402 payment → render + fit signal)
3. **Discover** similar physical items from human curators
4. **Order** the physical version from a human curator (second x402 payment)

The try-on IS the product for digital curators — there is no order endpoint.
The response directs the agent to a human curator for the physical version.

### Why

- **Pure x402 volume**: every digital try-on is a clean micropayment with no
  physical fulfillment, shipping, or inventory risk.
- **Digital-to-physical funnel**: digital curators are a discovery surface for
  human curators. The agent tries on a digital design, loves the look, then
  buys the similar physical item from a human curator.
- **Memorable artifacts**: the output is a visual render — an image the agent
  can take back to its human. Not a JSON status, a picture.
- **No new infrastructure**: the try-on endpoint, 0xSplits payouts, image
  generation pipeline, directory, and earnings endpoint all already exist.

### Revenue Model

| Transaction | Amount | Split |
|-------------|--------|-------|
| Digital try-on | 0.50 cUSD | 80% digital curator (via 0xSplits), 20% platform |
| Physical order | listing price | 95% human curator (via 0xSplits), 5% platform |

### Schema Changes

The `listings` table gains an `inventoryType` column:

- `physical` (default): links to `kit_skus`, has sizes + stock, ships to buyer
- `digital`: no `kit_sku` FK required, no stock/size constraints, the "garment
  image" is a generated design stored in R2

Digital listings are excluded from the order endpoint (404 with a pointer to
the try-on endpoint). They ARE included in the storefront and try-on endpoints.

### Similar Physical Items

When a try-on succeeds on a digital listing, the response includes a
`similarPhysicalItems` array — human curator listings matched by vertical and
style tags. This is the bridge from digital to physical commerce.

Matching is done by querying human curator listings that share vertical tags
with the digital listing, sorted by relevance (tag overlap count).

### Implementation

- `packages/db/src/schema/listings.ts`: add `inventoryType` column
- `apps/api/routes/agent-tryon.js`: return `similarPhysicalItems` for digital listings
- `apps/api/routes/curator-storefront.js`: include digital listings in storefront
- `apps/api/routes/curator-storefront.js`: 404 on order attempts for digital listings
- Digital garment images generated via Venice SD35 pipeline, stored in R2
- Digital curator created in Neon with `type: "ai"`, `agentCommerceEnabled: true`
- Digital curator gets a 0xSplits SplitV2 for try-on revenue

## Consequences

- The `listings` schema gains an `inventoryType` enum column (migration required)
- The try-on endpoint gains a "similar items" query for digital listings
- The order endpoint rejects digital listings with a helpful redirect
- Digital curators can generate x402 payment volume without physical inventory
- Human curators benefit from discovery traffic driven by digital curators
