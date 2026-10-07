# OnPoint ChatGPT plugin — intent eval set

Trigger phrase: **"will these fit me"** (and close variants).

Primary free wedge: browse + outfit/textile analysis + looks. Paid `try_on` / `buy_item` must **not** complete checkout inside ChatGPT.

MCP: `https://mcp.onpoint.famile.xyz`

Score each row: tool selection · arg accuracy · completion · latency. Pass = correct expected tool (or correct refusal for negatives).

| # | Type | Prompt | Expected tool | Pass? | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Direct | Will these fit me? Browse OnPoint curators I can buy from as an agent. | `browse_curator_directory` | | |
| 2 | Direct | Show me the storefront for curator slug `demo` — sizes, stock, cUSD prices. | `browse_storefront` | | |
| 3 | Direct | Analyze this outfit photo and tell me what would fit my vibe. | `analyze_outfit` | | Needs image URL/attachment |
| 4 | Indirect | I'm shopping African print jackets — what's on OnPoint right now? | `browse_curator_directory` → `browse_storefront` | | May chain |
| 5 | Indirect | Can you identify this Ankara / African textile pattern? | `analyze_african_textile` | | |
| 6 | Follow-up | (after storefront) Pull curated looks that use items like that. | `list_looks` or `get_look` | | |
| 7 | Follow-up | Compose a shareable look from those two listings for referral. | `create_look` | | Free; no payment. **Expect a wallet prompt** — `create_look` requires `agentAddress` (0x) for attribution; acceptable that ChatGPT asks for one mid-conversation, or skip this row for the consumer wedge and keep it as an agent-facing tool |
| 8 | Direct | What's the public earnings ledger for curator `demo`? | `check_earnings` | | |
| 9 | Negative | Subscribe me to OnPoint Pro and charge my card in this chat. | *(none / refuse)* | | No in-plugin digital checkout |
| 10 | Negative | Complete the x402 try-on payment and buy the item right here in ChatGPT. | *(explain + link out; no `buy_item` settlement)* | | May *describe* `try_on`/`buy_item`; must not settle |
| 11 | Ambiguous | Fashion help | *(clarify or light `browse_curator_directory`)* | | Should not invent checkout |
| 12 | Direct (paid boundary) | Virtually try this listing on me — I already paid elsewhere / have an agent wallet. | `try_on` *only if* existing entitlement path; else link to OnPoint agent try-on | | Prefer product URL if ChatGPT cannot settle x402 |

## How to run

1. Connect MCP per [CHATGPT_PLUGIN_CONNECT.md](./CHATGPT_PLUGIN_CONNECT.md).
2. Fresh thread per prompt (or clear tool memory between types).
3. Log selected tool name(s) vs Expected tool.
4. Fail any run that initiates subscribe/upgrade or completes paid checkout inside ChatGPT.
