# WhatsApp Business API Setup Guide

> **Phase 11 prerequisite** — Required to close the curator commerce loop (try-on → WhatsApp → purchase).
> Once configured, curators can manage inventory, receive orders, and message customers entirely through WhatsApp.

---

## Overview

OnPoint's WhatsApp integration enables:

- **Curator inventory management** via WhatsApp chat-ops (text `+ arsenal home M 2500 4` + photo → listing created)
- **Customer purchase flow** — try-on a product, get a WhatsApp deep link, and checkout with the curator
- **Order receipts** sent automatically via WhatsApp after purchase
- **Fulfilment updates** pushed to customers through WhatsApp

The WhatsApp pipeline is already built in `apps/api/agent-server.js`, `apps/api/routes/agent-whatsapp.js`, and `apps/web/lib/payments/send-receipt.ts`. The blocker is the Meta Business verification and API credentials.

---

## Prerequisites

| Item | Required? | Notes |
|------|-----------|-------|
| Meta Business Account | Required | Create at [business.facebook.com](https://business.facebook.com/) |
| Business Verification Documents | Required | Certificate of Incorporation, Business License, or Tax Registration |
| Website | Required | beonpoint.netlify.app — already live |
| Phone Number | Required | Can use a virtual number or existing business number |

---

## Step-by-Step Setup

### Step 1: Create a Meta Business Account

1. Go to [business.facebook.com/overview](https://business.facebook.com/overview)
2. Click **Create Account**
3. Enter your business name, name, and business email
4. Accept the terms

### Step 2: Create a Meta App

1. Go to [developers.facebook.com](https://developers.facebook.com/)
2. Click **My Apps** → **Create App**
3. Select **Business** as the app type
4. Enter app name (e.g., "OnPoint Commerce")
5. Link to your Business Account created in Step 1

### Step 3: Add WhatsApp Product

1. In your app dashboard, click **Add Product**
2. Find **WhatsApp** and click **Set Up**
3. You'll land on the WhatsApp API configuration page

### Step 4: Register a Phone Number

1. In the WhatsApp section, click **API Setup** (or similar)
2. Under **Phone numbers**, click **Manage phone numbers**
3. Click **Add phone number**
4. Enter your business phone number
5. Verify via SMS or voice call with the code sent

### Step 5: Get Permanent Access Token

1. In the WhatsApp configuration page, find **Access Token**
2. Click **Manage** next to the temporary token
3. Select your WhatsApp Business Account
4. Generate a **Permanent Access Token**
5. Copy this token — this is your `WA_ACCESS_TOKEN`

### Step 6: Find Your Phone Number ID

1. In the WhatsApp configuration page, find your registered number
2. The **Phone Number ID** is displayed next to the number
3. Copy this — this is your `WA_PHONE_NUMBER_ID`

### Step 7: Configure Webhook

1. In the WhatsApp section, go to **Configuration** → **Webhook**
2. Set the **Callback URL** to `https://api.onpoint.famile.xyz/api/agent/whatsapp/ingest`
3. Set a **Verify Token** (a random string you choose)
4. Subscribe to these fields:
   - `messages`
   - `message_deliveries`
   - `message_reads`

The webhook Verify Token needs to match the `WA_WEBHOOK_VERIFY_TOKEN` env var on the Hetzner server.

### Step 8: Verify Your Business

1. Go to **Business Manager** → **Business Settings** → **Security Center**
2. Click **Start Verification**
3. Provide:
   - Legal business name (must match registration documents)
   - Business address and phone
   - Upload one of: Certificate of Incorporation, Business License, Tax Registration
4. Wait for Meta's review (typically 2-5 business days)

> **Note:** You can send up to 250 conversations per day in sandbox mode without full verification. Full verification is needed for production scaling.

### Step 9: Set Environment Variables

In your Hetzner server's `.env.production`:

```bash
# WhatsApp Business API
WA_ACCESS_TOKEN=<permanent-token-from-step-5>
WA_PHONE_NUMBER_ID=<phone-number-id-from-step-6>
STORE_URL=https://beonpoint.netlify.app
```

In `apps/web/.env.local` (or Netlify env vars):

```bash
WA_ACCESS_TOKEN=<permanent-token-from-step-5>
WA_PHONE_NUMBER_ID=<phone-number-id-from-step-6>
```

---

## Message Templates (Optional)

Meta requires **pre-approved message templates** for proactive outreach (sending messages first, not just replying). Templates are needed for:

- Order confirmations
- Shipment tracking updates
- Abandoned cart reminders

To create templates:

1. In your WhatsApp Business Account dashboard, go to **Message Templates**
2. Click **Create Template**
3. Choose category (Marketing, Utility, Authentication)
4. Design the message with placeholders like `{{1}}`, `{{2}}`
5. Submit for review (approval takes 24-48 hours)

---

## Verifying It Works

### Health Check

```bash
curl https://api.onpoint.famile.xyz/api/agent/whatsapp/health
# Expected: { "status": "ready", "checks": { "waAccessToken": true, ... } }
```

### Send a Test Message

The agent server automatically responds to WhatsApp messages when configured. Send a message to the registered number — the webhook will route it through `agent-server.js`.

---

## Architecture

```
Customer WhatsApp ──► Meta Cloud API ──► Webhook ──► agent-server.js
                                                          │
                                                    ┌─────┴──────┐
                                                    │  resolve    │
                                                    │  curator    │
                                                    └─────┬──────┘
                                                          │
                                              ┌───────────┴───────────┐
                                              │                       │
                                        parseCommand           ingestMedia
                                              │                       │
                                      ┌───────┴───────┐       ┌─────┴─────┐
                                      │  inventory     │       │   R2      │
                                      │  (listings)    │       │  upload   │
                                      └───────┬───────┘       └─────┬─────┘
                                              │                       │
                                      ┌───────┴───────────────────────┴───┐
                                      │         Neon Database             │
                                      └───────────────────────────────────┘
```

---

## Troubleshooting

| Issue | Likely Cause | Fix |
|-------|-------------|-----|
| `WA_ACCESS_TOKEN and WA_PHONE_NUMBER_ID must be configured` | Missing env vars | Check `.env.production` on Hetzner |
| Webhook returns 401 | Verify token mismatch | Ensure `WA_WEBHOOK_VERIFY_TOKEN` matches the token in Meta dashboard |
| "Business not verified" error in logs | Meta verification incomplete | Complete Step 8 |
| Messages not delivering | Phone number not registered or deactivated | Re-register number in Meta dashboard |
| "Can't send messages outside 24-hour window" | Template not pre-approved | Create and submit a message template |

---

## Alternative: Twilio for WhatsApp

If Meta Cloud API direct doesn't work well, Twilio is a fallback:

1. Sign up at [twilio.com](https://twilio.com)
2. Enable WhatsApp in the Twilio console
3. Complete Meta Business verification through Twilio's guided flow
4. Use Twilio's API instead of Meta Cloud API directly

Twilio's flow is more guided but adds a per-message platform fee on top of Meta's fees.
