# Connect OnPoint MCP in ChatGPT Plugins

Public MCP (streamable HTTP): **`https://mcp.onpoint.famile.xyz`**

Also documented in [`/.well-known/agent.json`](https://onpoint.trustfall.xyz/.well-known/agent.json) (`endpoints[].type = "mcp"`) and OpenAPI at [`https://api.onpoint.famile.xyz`](https://api.onpoint.famile.xyz) / [`/openapi.json`](https://onpoint.trustfall.xyz/openapi.json).

## Live status caveat

`https://mcp.onpoint.famile.xyz` is the URL published in `agent.json`. As of packaging (2026-10-07), that hostname did **not** resolve from a public DNS lookup — deploy/DNS for the streamable-HTTP MCP host is a blocker before ChatGPT custom-MCP connect can succeed. Do not substitute invented hosts; fix DNS/deploy for the documented URL (or update `agent.json` + these docs together when the real public endpoint changes). Meanwhile OpenAPI/agent surfaces on `onpoint.trustfall.xyz` / `api.onpoint.famile.xyz` remain the documented non-MCP agent path.

## Steps (ChatGPT Plugins · custom MCP)

1. Open ChatGPT → **Plugins** (or [chatgpt.com/plugins](https://chatgpt.com/plugins)).
2. Tap **+** / **Add** → choose **custom MCP** (or equivalent "connect MCP server").
3. Paste the MCP URL: `https://mcp.onpoint.famile.xyz`  
   Transport: streamable HTTP (no path suffix required — the host *is* the MCP endpoint).
4. Save / connect. Let ChatGPT fetch tool metadata (`tools/list`).
5. **Refresh metadata** after any tool description or schema change on the server.
6. Smoke-test with prompts from [CHATGPT_PLUGIN_EVAL.md](./CHATGPT_PLUGIN_EVAL.md) and the directory examples in [CHATGPT_PLUGIN_STARTER_PROMPTS.md](./CHATGPT_PLUGIN_STARTER_PROMPTS.md).

## Free vs paid tools (do not checkout paid flows inside ChatGPT)

| Tool | Tier | ChatGPT posture |
| --- | --- | --- |
| `browse_curator_directory` | Free discovery | Prefer — directory wedge |
| `browse_storefront` | Free discovery | Prefer — size/stock/price browse |
| `analyze_outfit` | Free discovery | Prefer — photo style read |
| `analyze_african_textile` | Free discovery | Prefer — pattern ID |
| `list_looks` / `get_look` | Free discovery | Prefer — curated boards |
| `create_look` | Free discovery | Prefer — compose looks / referral code only |
| `check_earnings` | Free read | Prefer — public ledger |
| `try_on` | Paid (x402, ~$0.03–$0.05 cUSD) | **Do not complete payment in ChatGPT** — explain + deep-link to OnPoint / agent API |
| `buy_item` | Paid (x402 order) | **Do not checkout in ChatGPT** — hand off to storefront / WhatsApp / agent commerce on our URLs |

OpenAI plugin commerce for **physical goods** is constrained; treat ChatGPT as the **free fit/discovery surface**. Keep x402 try-on and buy on product / agent URLs (existing account or external product). See [CHATGPT_PLUGIN_PLAYBOOK.md](./CHATGPT_PLUGIN_PLAYBOOK.md).

## After connect

- Confirm all **10** tools appear in metadata.
- Run the eval set; track expected tool column.
- Directory listing: use starter prompts (user language), not screenshots; no pricing/promos in the listing blurb.
