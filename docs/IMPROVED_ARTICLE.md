*This is a submission for the [GitHub Finish-Up-A-Thon Challenge](https://dev.to/challenges/github-2026-05-21)*

---

## What I Built

**[OnPoint](https://beonpoint.netlify.app)** is a curator-first AI fashion studio — a multiplatform ecosystem for personalized styling, fashion discovery, and digital ownership.

The pitch in one line: *stylists hand customers a branded try-on → polaroid → share → buy loop, and every session generates live retail intelligence on the back end.*

The problem OnPoint solves is one that exists at the intersection of two broken experiences. For shoppers, fashion discovery is noisy and impersonal — you scroll endlessly, get generic recommendations, and can't actually tell if something will work on you before you buy it. For retailers and stylists, the data they need to make good decisions (what's missing from the catalog, what competitors are pricing, what customers are actually reaching for) is either locked behind expensive tools or not collected at all.

OnPoint closes both gaps at once. Shoppers get a real-time AI styling session — point a camera at an outfit, get instant AI coaching overlays, discover matched products, and buy. Stylists and curators get the same flow turned into live GTM intelligence: product gaps surfaced when the catalog can't match, competitor pricing pulled from the open web, demand signals extracted from actual shopper intent.

The platform also has a meaningful on-chain layer. Each agent has an ERC-8004 identity ([Agent ID 9177](https://8004scan.io/agents/celo/9177)), an agent wallet on Celo, and session data can be stored verifiably via IPFS/Filecoin through Lighthouse. Style memory persists across sessions. Spending controls let small actions auto-execute while larger ones require approval — a pattern borrowed from the agentic infrastructure world.

The stack: Next.js frontend on Netlify, Express API and Python FastAPI agent bridge on Hetzner, multi-chain support across Celo, Base, Ethereum, and Polygon, with AI routing across Venice AI, Google Gemini Live, OpenAI, and AI/ML API.

---

## Demo

🔗 **Live app:** [beonpoint.netlify.app](https://beonpoint.netlify.app)
🔗 **Source:** [github.com/thisyearnofear/onpoint](https://github.com/thisyearnofear/onpoint)
🔗 **Agent identity:** [8004scan.io/agents/celo/9177](https://8004scan.io/agents/celo/9177)

Key flows to try:

- Upload a photo or use your camera for live AR styling feedback
- Watch the agent search the open web when the catalog doesn't have a match
- Check the retail intelligence panel for product gap and competitor pricing signals
- Connect a wallet (RainbowKit) and explore the on-chain agent identity layer

---

## The Comeback Story

OnPoint started as a hackathon project — actually, several hackathon projects running in parallel. The core try-on and styling loop worked, but the repo was a tangle of independent feature branches that had never been properly integrated: Bright Data web intelligence from one hackathon, Auth0 Token Vault from another, the Celo agent wallet from a third, IPFS storage from Protocol Labs Genesis. Each piece worked in isolation. Together, they were a mess.

The finish-up work was fundamentally about turning a collection of demos into a coherent product.

**The specific problem:** The agent heartbeat ran on Vercel serverless functions with a 60-second cap — it couldn't maintain the "agent works while you sleep" promise. Every autonomous action was an ephemeral serverless invocation with no retry, no state, and no visibility. The agent's "while you sleep" promise was aspirational marketing, not architecture.

**Monorepo consolidation** — The project moved to a proper Turborepo monorepo with `apps/web`, `apps/api`, and `apps/bridge` as distinct units with shared packages. This eliminated a category of integration bugs where different parts of the codebase had drifted out of sync.

**ADR 0001 — Backend-First Autonomy** — The fix was moving stateful loops to Hetzner, which required extracting `agent-core` into a shared package both runtimes could import. The ADR process forced me to write down the decision: what lives on Vercel (presentation + identity), what lives on Hetzner (autonomy + AI + signing + state). The signer isolation (Phase 4) is the security-critical piece that makes the "agent spends your money" pitch credible — the private key lives behind a loopback-only process, not in Vercel env vars.

**Curator primitive** — The biggest conceptual addition was formalizing the curator role. Previously the platform was shopper-facing only. The new [ADR 0002 — Curator Primitive](https://github.com/thisyearnofear/onpoint/blob/master/docs/adr/0002-curator-primitive.md) defined the curator flow as a first-class feature: the same styling session that serves a shopper also generates structured retail intelligence for the curator who runs the storefront.

**Agent web discovery** — When the catalog lacks a match, the agent now autonomously browses the open web via Browser Use Cloud and Bright Data, then surfaces competitor options, price comparisons, and recommended actions. The suggestion includes name, price, source URL, and an image — surfaced in the wallet panel as an "Agent Discovery" card. This is the GTM intelligence: not a dashboard, but a structured signal the curator can act on.

**Auth0 Token Vault** — External API credentials (Calendar, Slack, and others) are now managed through Auth0 Token Vault using RFC 8693 Token Exchange. This means the agent can act on behalf of users without those users handing raw API keys to a third party.

**Spending controls and fraud detection** — Configurable autonomy thresholds (small actions auto-execute, large ones require approval) and persistent style memory that learns preferences across sessions. The spending controls layer includes a fraud detection system: Dead Man's Switch monitors heartbeat health (3 missed check-ins → agent frozen), anomaly scoring (0-100, auto-freezes at 75), velocity checks (20 tx/hour threshold), and multi-sig for transactions over $500. Every suspicious pattern increments an anomaly score that can trigger a freeze. This isn't safety theater — it's the trust layer that makes the "agent spends your money" pitch credible.

**Monitoring stack** — After the Hetzner migration, I added Prometheus + Grafana with alerting rules for agent availability, gas balance, heartbeat health, escrow balances, and action latency. The heartbeat latency dropped from "serverless cold start" (~8s) to <100ms on the persistent worker. The autonomous executor now handles nonce management via Redis atomic INCR — no more nonce-dance crashes on retry. These aren't glamorous metrics, but they're the difference between "works in demo" and "works in production."

**Farcaster miniapp frame** — The app now ships as a Farcaster-compatible miniapp frame, making it discoverable and launchable directly from the Farcaster social layer.

---

## Demo

🔗 **Live app:** [beonpoint.netlify.app](https://beonpoint.netlify.app)
🔗 **Source:** [github.com/thisyearnofear/onpoint](https://github.com/thisyearnofear/onpoint)
🔗 **Agent identity:** [8004scan.io/agents/celo/9177](https://8004scan.io/agents/celo/9177)

Key flows to try:

- Upload a photo or use your camera for live AR styling feedback
- Watch the agent search the open web when the catalog doesn't have a match
- Check the retail intelligence panel for product gap and competitor pricing signals
- Connect a wallet (RainbowKit) and explore the on-chain agent identity layer

---

## My Experience with GitHub Copilot

OnPoint spans more languages and runtimes than most projects its size — TypeScript for the Next.js frontend and Express API, Python for the FastAPI agent bridge, Solidity for the on-chain contracts, and shell scripts for deployment. Switching contexts across all of these in a single session is where Copilot earned the most.

**Cross-language consistency** — When I was wiring the Python bridge to the TypeScript API, Copilot helped keep the interface contracts consistent. It would suggest Python function signatures that mirrored the TypeScript types I'd defined, which caught a handful of mismatches before they became runtime errors.

**Boilerplate for the multi-chain wallet integration** — RainbowKit + Wagmi + multi-chain configuration has a lot of repetitive ceremony. Copilot handled the per-chain config objects and provider setup cleanly, letting me focus on the parts that were actually different (the ERC-8004 agent identity integration).

**The agent bridge** — The Browser Use Cloud and Bright Data integration in the Python bridge was new territory. Copilot's suggestions weren't always correct on the first pass, but they were a useful starting point that surfaced the right API surface to explore. The edit-and-accept loop was faster than reading docs cold.

**Writing test mocks** — The fraud detection tests required mocking Redis across 14 scenarios: high velocity, unusual amounts, Dead Man's Switch triggers, multi-sig lifecycle, alert resolution. Writing those mocks forced me to think through edge cases I hadn't considered: what happens when an agent has no prior heartbeat? What about zero-value transactions? The test file became documentation.

**ADR drafting** — This was a surprise. When I was writing Architecture Decision Records for the curator primitive and the token vault integration, Copilot's inline suggestions helped maintain the consistent structure (Context → Decision → Consequences) and often anticipated the trade-offs I was about to articulate. Good documentation is underrated as a Copilot use case.

The honest caveat: the hardest decisions — how to model the curator flow, how to structure spending controls, whether to use a monorepo — Copilot didn't make. Those required thinking through the product and the trade-offs. What Copilot did was compress the distance between decision and working code, which for a project with this much surface area made a real difference.

---

## What I'd Do Differently

I'd have extracted `agent-core` earlier. The extraction was necessary but disruptive — it touched every agent endpoint. If I'd started with the package structure, the Hetzner migration would have been a deployment change, not a refactor.

I'd also have been more conservative about the chrome-extension. It shipped but hasn't been maintained — better to have left it as a future phase than carry dead code in a monorepo.

The ADR process was right, but I wrote ADR 0001 after the migration was done. Writing it before would have caught the signer isolation requirement earlier — the private key in Vercel env vars was a security gap that the ADR forced me to confront.

---

*Find me on [Farcaster](https://farcaster.xyz/papa) and [Lens](https://palus.app/u/papajams) — always building at the intersection of AI, emerging markets, and on-chain infrastructure.*
