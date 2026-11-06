# Switch Hackathon integration plan — OnPoint

This document is the build frame of reference for adapting OnPoint to the Flip the Switch Hackathon.

## Goal
Show a team commerce room where an AI agent handles requests, a curator approves, and payment/payout receipts are posted, using Switch.

## Current relevant surfaces
- Agent manifest: `/.well-known/agent.json`
- Paid try-on: x402 flow
- Agent checkout: ADR 0010, 0017
- Payouts: curator wallets

## Switch integration architecture

### Room
- Create a team room (e.g. `curator-orders`).
- Add the OnPoint agent as a teammate.
- Use chat messages for requests, approvals, execution, and receipts.

### Agent workflow
1. Request posted in room.
2. Agent analyzes and proposes order.
3. Curator approves.
4. Agent executes try-on/checkout.
5. Agent posts receipt/payout.

### AI layer
- Keep agent manifest and MCP tools.
- Keep try-on and checkout logic.
- Use receipts as trust layer.

## Week plan (4 days)
- [ ] Set up Switch + Mattermost local room.
- [ ] Connect OnPoint agent to the room.
- [ ] Implement request → proposal → approval flow.
- [ ] Implement execution + receipt posting.
- [ ] Polish demo and README.
- [ ] Record video and submit.

## Demo script
1. Buyer posts request → agent proposes order.
2. Curator approves → agent processes payment.
3. Agent posts receipt + payout → team sees confirmation.

## Risks and fallbacks
- If payment integration is too heavy, simulate and show recorded transaction.
- If Switch setup is slow, use Mattermost local quickstart and keep scope small.
