# Agent Referral Tracking Guide

> Earn 2.5% commission by referring customers to OnPoint curator storefronts.

## How It Works

When an agent shares a referral link or includes a referral code in an order request, the platform tracks the referral and automatically calculates a 2.5% commission on the order value.

## Using Referral Codes

### Method 1: Header (Recommended for API Clients)

```bash
POST /api/curator/wanja/order
X-Referral-Code: ref_abc123...
Content-Type: application/json

{ "listingId": "abc123", "size": "M", "quantity": 1 }
```

### Method 2: Query Parameter (For Shareable Links)

```bash
POST /api/curator/wanja/order?referral=ref_abc123...
Content-Type: application/json

{ "listingId": "abc123", "size": "M", "quantity": 1 }
```

## Referral Link Format

```
https://onpoint.trustfall.xyz/r/[referralCode]
```

When users visit a referral link:

1. The referral code is stored in sessionStorage
2. The code is attached to payments the visitor makes in that session
3. Commission depends on how the order is placed:
   - **Agent API orders** (`POST /api/curator/{slug}/order`) earn the referring agent 2.5%.
   - **Storefront M-Pesa orders** placed by people in a browser record the referral on the order for attribution, but **do not currently pay a commission**: those orders settle in KES, and the commission rail is cUSD.

## Rules

- Self-referral is ignored: no commission is recorded when the paying wallet is the referring agent.
- A referral code that does not resolve to an agent address (unknown, malformed, or ambiguous) records no commission. Codes are `ref_` plus the first 8 hex characters of the agent's wallet address, and are matched case-insensitively against agents that own looks or have earned referrals before.
- Visits to `/r/[referralCode]` are logged as `referral_visit` events.
- To tie an order to a specific look share, also send `X-Share-Id` (or `?sid=`); see [Share Attribution](../../AGENTS.md#share-attribution).

## Viewing Your Earnings

### Agent Dashboard

```bash
GET /api/agent/dashboard
```

Response shape example (illustrative, not a current production snapshot) includes:

```json
{
  "referrals": {
    "totalReferrals": 15,
    "totalCommissionCusd": "125.50",
    "pendingCommissionCusd": "45.20",
    "paidCommissionCusd": "80.30",
    "recentActivity": [
      {
        "referralCode": "ref_abc123",
        "orderAmountCusd": "19.23",
        "commissionCusd": "0.48",
        "status": "paid",
        "curatorSlug": "wanja",
        "createdAt": "2026-07-15T10:30:00Z",
        "payoutTxHash": "0x..."
      }
    ]
  }
}
```

### Dashboard UI

Visit `https://onpoint.trustfall.xyz/agent` to view:

- Total referrals and commission earned
- Pending and paid commissions
- Recent referral activity
- Copyable referral link

The weekly pilot report should use actual dashboard/ledger data for the reporting window; the example values above must not be treated as current referral traction.

## Referral Status

- **pending**: Commission recorded but not yet paid out
- **paid**: Commission has been transferred to the agent's wallet
- **failed**: Commission payout failed (contact support)

## Best Practices

1. **Share polaroid links**: After a try-on, share the polaroid web URL with your referral code
2. **Use header method**: When making API calls, prefer the `X-Referral-Code` header
3. **Track your earnings**: Regularly check the agent dashboard for commission status
4. **Share on social**: Include referral links in social media posts about curator products

## Commission Calculation

Commission is calculated as 2.5% of the total order value in cUSD.

Example:

- Order total: 19.23 cUSD
- Commission: 19.23 × 0.025 = 0.48 cUSD

## Technical Details

- Referral data is stored in the `agent_referrals` table
- Commissions are tracked per order in the `orders.referral_code` column
- Payout status is managed by the platform
- All referral transactions are visible on the agent dashboard
