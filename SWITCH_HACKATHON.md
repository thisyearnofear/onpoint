# SWITCH_HACKATHON.md — Flip the Switch Hackathon (WeMakeDevs x DevTools Academy x Switch)

> Project: **OnPoint — Agentic Fashion Commerce**
> Event: Flip the Switch Hackathon (Nov 4–7, 2026, online)
> Prize pool: $10,000
> Requirement: **Switch must be central**; workflow built during the hackathon
> Repo: https://github.com/thisyearnofear/onpoint
> Live: https://onpoint.trustfall.xyz

## 1. Event essentials
- Build window: **Nov 4 12:01 AM IST → Nov 7 11:59 PM IST, 2026**.
- Format: online, solo or team up to 4.
- Core challenge: turn a solo AI agent into a teammate in Slack/Teams/Discord/Telegram/Mattermost using Switch.
- Switch must be central; README must show how Switch is used.
- Existing agents/projects are allowed; Switch setup + workflow must be built during the hackathon.
- Judging: technical execution, creativity/impact, presentation.

## 2. Why OnPoint is a strong Switch candidate
OnPoint already has an agent commerce loop:
- agent manifest and MCP tools,
- paid try-on and checkout,
- curator storefronts and payouts,
- agent identity and spending controls.

For Switch, reframe this as a **team commerce room**: curators, buyers, and agents coordinate orders, approvals, try-ons, and payouts in chat.

## 3. Team-task concept
### Primary concept: Curator + Agent Order Room
A curator team uses a chat room to handle incoming agent/customer orders.

**Room workflow:**
1. Buyer/agent posts a purchase or try-on request.
2. OnPoint agent checks inventory, fit, and pricing.
3. Curator approves or adjusts the order.
4. Agent processes try-on/checkout.
5. Agent posts payment/payout receipt in the room.
6. Team sees order status and payout confirmation.

**Why it fits Switch:** clear multi-person task with approvals, execution, and receipts.

## 4. Minimum viable win (4 days)
Scope to **one curator, one item, one order flow**.

1. Request posted in room.
2. Agent analyzes and proposes order.
3. Curator approves.
4. Agent executes try-on/checkout.
5. Agent posts receipt/payout.

## 5. Demo script (do X, see Y)
1. Buyer posts request → agent proposes order.
2. Curator approves → agent processes payment.
3. Agent posts receipt + payout → team sees confirmation.

## 6. Risks and fallbacks
- **Risk:** payment integration too heavy.  
  **Fallback:** simulate payment and show recorded transaction.
- **Risk:** Switch setup delays.  
  **Fallback:** use Mattermost local quickstart and keep scope small.

## 7. Submission checklist
- [ ] Switch central to project
- [ ] README shows how Switch is used
- [ ] Working room workflow demo
- [ ] Demo video/screenshots
- [ ] Public repo
- [ ] Submitted by Nov 7 11:59 PM IST
