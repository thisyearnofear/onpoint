# ADR 0005: Agent Spending Controls First, OWS Optional

## Status

Accepted

## Context

OnPoint is building an autonomous styling and commerce agent. Users care that
the agent can act safely: browse, recommend, reserve, tip, buy, mint, and record
receipts without exceeding the authority they granted.

Open Wallet Standard (OWS) can support policy-gated signing and agent-compatible
payment flows, but it currently ships native binaries and is not required for
the core user-facing value. Treating OWS as a primary web dependency caused
Next.js build failures and made the architecture more fragile.

## Decision

The product primitive is **Agent Spending Controls**, not "OWS support".

Spending controls must be understandable to users and enforceable by backend
services:

- Daily and weekly spend caps
- Per-action and per-purchase approval thresholds
- Allowed action types: browse, reserve, tip, buy, mint
- Allowed chains, tokens, merchants, and Curators
- Visible policy summaries in the UI
- Signed audit logs and receipts for autonomous actions

OWS remains an optional backend enforcement layer. It may be used when it
materially improves safety or interoperability, but it must not be required for
the web app build or advertised as a user-facing capability by default.

## Consequences

- The web app must not directly depend on `@open-wallet-standard/core`.
- Native OWS loading stays runtime-only and optional inside backend-capable
  wallet services.
- User-facing capabilities should advertise policy-backed spending controls,
  not implementation details like OWS.
- OWS should be kept only if it supports a concrete product feature:
  wallet-scoped agent permissions, signing-layer spend limits, x402-compatible
  agent payments, or auditable partner policies.
- If those features are not shipped, OWS should be removed entirely in a later
  cleanup.

## Follow-Up Work

- Add UI for policy summaries and approval thresholds.
- Persist policy definitions alongside agent controls.
- Decide whether signing-layer enforcement is required before increasing
  autonomous purchase limits.
- Remove OWS from docs and runtime code if it remains unused after the next
  spending-controls milestone.
