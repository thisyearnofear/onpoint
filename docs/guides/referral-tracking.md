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
https://beonpoint.netlify.app/r/[referralCode]
```

When users visit a referral link:
1. The referral code is stored in sessionStorage
2. The code is automatically attached to subsequent orders
3. When the user completes a purchase, the referring agent earns 2.5% commission

## Viewing Your Earnings

### Agent Dashboard

```bash
GET /api/agent/dashboard
```

Response includes:

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

Visit `https://beonpoint.netlify.app/agent` to view:
- Total referrals and commission earned
- Pending and paid commissions
- Recent referral activity
- Copyable referral link

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
