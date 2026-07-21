# OnPoint MCP Server

> Agent-commerce-ready African fashion inventory on Celo. Any MCP-compatible agent can browse curators, try on items with x402-paid AI try-on, buy physical items with cUSD on Celo, compose looks, and earn 2.5% referral commissions.

**Live API:** https://api.onpoint.famile.xyz  
**Web app:** https://beonpoint.netlify.app  
**Manifest:** https://beonpoint.netlify.app/.well-known/agent.json  
**Chain:** Celo mainnet (chainId 42220)  
**Payment tokens:** cUSD, USDC  
**Attribution:** ERC-8021 (auto-tagged for hackathon leaderboard credit)

Built for the **Celo Agentic Payments + DeFAI Hackathon**.

---

## Why this MCP server

OnPoint is the execution layer for fashion intent that needs fit, real stock, and local pay. Curators list physical inventory on storefronts; humans shop via WhatsApp; **agents hit the same inventory via this MCP server** with x402 try-on and on-chain checkout.

This MCP server makes OnPoint's agent commerce flow discoverable by any agent framework — Claude, Qwen Agent, ElizaOS, LangChain, CrewAI, or any MCP-compatible client. No need to read the OpenAPI spec or implement the 402 payment flow from scratch; the tools surface 402 challenges as structured data and the agent framework handles the rest.

**The wedge:** OnPoint is the only agent-commerce-ready African fashion inventory on Celo. Real garments, real stock, real try-on (Replicate IDM-VTON on the actual garment, not text-to-image "similar look"), real on-chain settlement.

---

## Tools (10)

### Browse (free, no auth)

| Tool | Description |
|------|-------------|
| `browse_curator_directory` | Discover curators with agent-purchasable inventory (wallet + live physical SKUs). |
| `browse_storefront` | Browse a curator's storefront — profile + live listings with agent commerce offers (size, stock, priceCusd). |
| `list_looks` | Browse curated style boards composed from OnPoint listings. Filter by curator, tag, agent, category, occasion, season. |
| `get_look` | Get a single look with resolved items, hero piece, referral code, and share URL. |
| `check_earnings` | Public reconciled earnings ledger for a curator — try-on fees, order payouts, referral commissions. All settlements on Celo. |

### Vision (free, ~$0.0001/call via Qwen Cloud)

| Tool | Description |
|------|-------------|
| `analyze_outfit` | Qwen3-VL vision analysis of an outfit photo. Goals: daily, event, critique, african. |
| `analyze_african_textile` | Specialized identification of African textile patterns (Ankara, Kente, Adire, Bogolan, Shweshwe, Kitenge, Wax Print) with cultural context. |

### x402 paid (Celo mainnet)

| Tool | Cost | Description |
|------|------|-------------|
| `try_on` | $0.03 digital / $0.05 physical cUSD | x402-paid virtual try-on. Returns 402 challenge → agent pays cUSD on Celo → re-calls with `paymentTxHash` → get try-on render, fit signal, and polaroid. ERC-8021 attribution in every 402 response. |
| `buy_item` | Listing price cUSD | x402-paid checkout for physical items. Returns 402 challenge → agent pays cUSD to curator's wallet (with attribution dataSuffix) → re-calls with `paymentTxHash` + `quoteId` → confirm order with Celoscan links and receipt. Optional `referralCode` for 2.5% agent-to-agent commission. |

### Agent-to-agent payments

| Tool | Description |
|------|-------------|
| `create_look` | Compose OnPoint listings into a shareable look (style board). Requires `agentAddress` (used for `x-agent-address` auth header). The created look carries a `referralCode` — when other agents buy items via `buy_item` with that `referralCode`, the look creator earns 2.5% commission auto-settled on Celo every 30 minutes. This is the agent-to-agent payment flow: create value → share → earn on-chain. |

---

## Quick start

### stdio transport (local agent runtimes)

```bash
# From the onpoint repo root
npx tsx packages/qwen-mcp/src/index.ts
```

Configure in Claude Desktop, Qwen Agent, or any MCP client:

```json
{
  "mcpServers": {
    "onpoint": {
      "command": "npx",
      "args": ["tsx", "/path/to/onpoint/packages/qwen-mcp/src/index.ts"],
      "env": {
        "ONPOINT_API_BASE": "https://api.onpoint.famile.xyz"
      }
    }
  }
}
```

### HTTP transport (remote agents, hackathon demos)

```bash
MCP_HTTP_PORT=3001 npx tsx packages/qwen-mcp/src/index.ts
```

Health check: `GET http://localhost:3001/`  
MCP endpoint: `POST http://localhost:3001/` (with `Accept: application/json, text/event-stream`)

### MCP inspector

```bash
npx @modelcontextprotocol/inspector npx tsx packages/qwen-mcp/src/index.ts
```

---

## Reference agents

### Buyer agent — full x402 commerce flow

```bash
# Dry run (tests 402 flow without paying)
node scripts/agent-mcp-buyer.mjs --dry-run

# Real transactions (needs cUSD + CELO for gas)
AGENT_PRIVATE_KEY=0x... node scripts/agent-mcp-buyer.mjs
```

### Agent-to-agent referral demo

```bash
# Dry run
STYLIST_PRIVATE_KEY=0x... BUYER_PRIVATE_KEY=0x... node scripts/agent-mcp-referral.mjs --dry-run

# Live (Agent A creates a look, Agent B buys, Agent A earns 2.5%)
STYLIST_PRIVATE_KEY=0x... BUYER_PRIVATE_KEY=0x... node scripts/agent-mcp-referral.mjs
```

---

## The x402 flow (how paid tools work)

Both `try_on` and `buy_item` follow the same pattern:

1. **Call the tool without `paymentTxHash`** → tool returns `{ status: "payment_required", challenge: {...}, nextStep: "..." }`
2. **The challenge contains:**
   - `payTo` — the Celo address to pay (curator's 0xSplits or platform wallet)
   - `priceCusd` / `totalCusd` — the amount in cUSD
   - `attribution.dataSuffix` — ERC-8021 attribution bytes to append to the tx data (for hackathon leaderboard credit)
   - `quoteId` — required for order confirmation (buy_item only)
3. **Agent pays cUSD on Celo** — transfer to `payTo`, appending `dataSuffix` to the tx data
4. **Re-call the tool with `paymentTxHash`** (and `quoteId` for buy_item) → tool verifies on-chain, returns success with render/order/receipt

### ERC-8021 attribution

Every 402 response includes an `attribution.dataSuffix` carrying the platform attribution code and assigned tag in an ERC-8021 array. Append this to your cUSD transfer transaction data — it's how the hackathon leaderboard counts your transactions.

```javascript
const txData = encodeFunctionData({
  abi: ERC20_ABI,
  functionName: "transfer",
  args: [payTo, amountWei],
}) + dataSuffix.replace(/^0x/, ""); // append attribution

await wallet.sendTransaction({ to: CUSD_ADDRESS, data: txData });
```

---

## Agent-to-agent referral payments

OnPoint's referral system enables agent-to-agent payments on Celo:

1. **Agent A** calls `create_look` with its `agentAddress` → gets a look with a `referralCode` (format: `ref_<first 8 hex chars of agentAddress>`)
2. **Agent B** discovers the look via `list_looks` or `get_look` → calls `buy_item` with that `referralCode`
3. **Agent A's wallet** receives 2.5% of the order value — auto-settled on Celo every 30 minutes by the payout worker

This is a real agent-to-agent payment: Agent A creates value (a curated look), Agent B acts on it (a purchase), and Agent A earns on-chain. No manual invoicing, no off-chain settlement — the commission flows through the same Celo transaction as the purchase.

---

## Pricing

| Action | Cost | Split |
|--------|------|-------|
| Browse (directory, storefronts, looks, earnings) | Free | — |
| Vision analysis (outfit, African textile) | ~$0.0001 | Qwen Cloud |
| Digital try-on (agent, paid) | $0.03 cUSD | 80% curator / 20% platform |
| Physical try-on (agent, paid) | $0.05 cUSD | 95% curator / 5% platform |
| Physical order | Listing price (KES → cUSD) | 95% curator / 5% platform |
| Referral commission | 2.5% of order value | Paid to referring agent |

All payments in cUSD or USDC on Celo mainnet.

---

## Environment variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `ONPOINT_API_BASE` | `https://api.onpoint.famile.xyz` | No | OnPoint API base URL |
| `MCP_HTTP_PORT` | — | No | Set to enable HTTP transport (stdio is default) |
| `DASHSCOPE_API_KEY` | — | No | Qwen Cloud API key for vision tools. Optional — only needed for `analyze_outfit` / `analyze_african_textile`. |
| `QWEN_CLOUD_VISION_MODEL` | `qwen3-vl-flash` | No | Qwen vision model override |
| `QWEN_CLOUD_KILL_SWITCH` | `0` | No | Set to `1` to disable vision tools |

---

## Links

- **Strategy:** [docs/STRATEGY.md](../../docs/STRATEGY.md)
- **Architecture:** [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)
- **Agent commerce guide:** [docs/guides/agent-commerce.md](../../docs/guides/agent-commerce.md)
- **OpenAPI contract:** [apps/web/public/openapi.json](../../apps/web/public/openapi.json)
- **Reference buyer:** [scripts/agent-mcp-buyer.mjs](../../scripts/agent-mcp-buyer.mjs)
- **Reference referral demo:** [scripts/agent-mcp-referral.mjs](../../scripts/agent-mcp-referral.mjs)
- **Hackathon:** Celo Agentic Payments + DeFAI Hackathon

## License

MIT
