# Meta Business Verification — WhatsApp Outbound Messaging

> Checklist for getting OnPoint's WhatsApp agent approved for outbound
> business-initiated messages via the WhatsApp Business Cloud API.

---

## Prerequisites

- [ ] Meta Business Portfolio (business.facebook.com) created
- [ ] WhatsApp Business Account (WABA) created and linked to the portfolio
- [ ] Phone number provisioned (Twilio or direct) and registered with the WABA
- [ ] App created in Meta for Developers with `whatsapp_business_messaging` permission

---

## Step 1: Business Verification

Meta must verify your legal business before you can send outbound messages at scale.

### Documents Required

| Document | Purpose | Notes |
|----------|---------|-------|
| **Certificate of Incorporation** or **Business License** | Proves legal existence | Must match the legal name in the Meta Business Portfolio exactly |
| **Utility bill** (electricity, water, gas) | Verifies business address | Must show business name + address, dated within 90 days |
| **Bank statement** | Alternative address proof | Must show business name + address |
| **Tax registration document** | Alternative address proof | KRA PIN certificate (Kenya) or equivalent |

### Submission Steps

1. Go to [business.facebook.com](https://business.facebook.com) → **Security Center**
2. Click **Start Verification** under Business Verification
3. Enter legal business name **exactly** as it appears on documents
4. Enter business address and phone number (must match documents)
5. Upload one of the required document pairs above
6. Submit and wait for Meta's review

### Timeline

- **Typical**: 2–7 business days
- **Can take longer** if documents are unclear or information doesn't match
- **Track status** in Security Center → Business Verification

---

## Step 2: WhatsApp Message Templates

Outbound (business-initiated) messages require **pre-approved templates**.
You cannot send free-form messages to users who haven't messaged you in 24 hours.

### Required Templates for OnPoint

| Template Name | Category | Purpose | Example |
|---------------|----------|---------|---------|
| `order_confirmation` | Utility | Confirm an order received | "Hi {{1}}, we've received your order for the {{2}} kit in {{3}}. Wanja will confirm stock shortly." |
| `stock_update` | Utility | Notify when stock arrives | "Hi {{1}}, the {{2}} {{3}} kit is now in stock in size {{4}}! Reply to order." |
| `delivery_update` | Utility | Delivery status update | "Hi {{1}}, your order {{2}} is out for delivery. Expected arrival: {{3}}." |
| `payment_reminder` | Utility | M-Pesa payment follow-up | "Hi {{1}}, just a quick reminder to send your M-Pesa confirmation code for the {{2}} kit." |
| `new_arrivals` | Marketing | New inventory alert | "🆕 New drop from {{1}}: {{2}} just landed! Check it out at {{3}}" |

### Template Submission Steps

1. Go to [business.facebook.com](https://business.facebook.com) → **WhatsApp Manager** → **Message Templates**
2. Click **Create Template**
3. Choose category: **Utility** (for transactional) or **Marketing** (for promotional)
4. Write template with `{{1}}`, `{{2}}` placeholders for dynamic content
5. Add sample values for each placeholder (required for review)
6. Submit for review

### Template Review Timeline

- **Typical**: Minutes to a few hours
- **Rejection** is common on first attempt — fix and resubmit
- Templates must comply with [WhatsApp Commerce Policy](https://www.whatsapp.com/legal/commerce-policy/)

### Template Best Practices

- Keep templates concise and clear
- Use `{{n}}` placeholders for personalization
- Avoid all-caps, excessive punctuation, or spammy language
- Utility templates have higher approval rates than Marketing
- Include opt-out language for Marketing templates

---

## Step 3: Messaging Limits

After Business Verification, Meta applies messaging limits:

| Quality Rating | Starting Limit | How to Increase |
|---------------|----------------|-----------------|
| High | 1,000 conversations/day | Send quality messages; limit auto-increases |
| Medium | 1,000 conversations/day | Improve quality; may be capped |
| Low | Limited or suspended | Fix issues immediately |

- **Conversations** = 24-hour window of back-and-forth messaging
- **Free tier**: 1,000 service-initiated conversations/month (for testing)
- Limits increase automatically based on volume + quality rating

---

## Step 4: Production Readiness Checklist

- [ ] Business Verification **approved** in Security Center
- [ ] At least 2–3 message templates **approved** (utility category)
- [ ] Phone number verified and **not** in quality warning state
- [ ] Webhook endpoint configured and responding (for inbound messages)
- [ ] `verify_tokens` and `access_token` set in `.env`
- [ ] Test outbound template message to a known number
- [ ] Monitor Quality Rating in WhatsApp Manager

---

## Costs

| Item | Cost |
|------|------|
| Business Verification | Free |
| WhatsApp Business API access | Free |
| Service conversations (user-initiated) | First 1,000/month free, then ~$0.00–0.05 depending on region |
| Utility conversations (business-initiated) | ~$0.02–0.08 per conversation |
| Marketing conversations (business-initiated) | ~$0.05–0.15 per conversation |

> **Kenya-specific**: Utility conversations are among the cheapest categories.
> Pricing varies — check [Meta's pricing page](https://developers.facebook.com/docs/whatsapp/pricing/) for current rates.

---

## Timeline Estimate

| Step | Duration |
|------|----------|
| Meta Business Portfolio setup | 1 day |
| Business Verification review | 2–7 business days |
| Template creation + approval | 1–2 days |
| Webhook + integration testing | 1–2 days |
| **Total** | **~2 weeks** |

---

## References

- [WhatsApp Business Management API](https://developers.facebook.com/docs/whatsapp/business-management-api/)
- [Message Templates Guide](https://developers.facebook.com/docs/whatsapp/message-templates/)
- [WhatsApp Pricing](https://developers.facebook.com/docs/whatsapp/pricing/)
- [Commerce Policy](https://www.whatsapp.com/legal/commerce-policy/)
- [Meta Business Help Center](https://www.facebook.com/business/help)
