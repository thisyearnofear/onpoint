# Auth0 Token Vault Setup Checklist

Use this checklist to verify your Auth0 tenant is properly configured for the Token Vault integration.

## ✅ Configuration Status

### 1. Environment Variables (`.env.local`)
- [x] `AUTH0_DOMAIN` — Set to: `dev-epemgbox1ty8vjf8.uk.auth0.com`
- [x] `AUTH0_CLIENT_ID` — Set (32 characters)
- [x] `AUTH0_CLIENT_SECRET` — Set (64 characters)
- [x] `AUTH0_SECRET` — Set (64 characters)
- [x] `AUTH0_BASE_URL` — Set to: `http://localhost:3000`
- [ ] `AUTH0_MANAGEMENT_API_TOKEN` — Optional (for connection revocation)

### 2. Auth0 Dashboard Configuration

Visit: https://manage.auth0.com/dashboard/us/dev-epemgbox1ty8vjf8/

#### Application Settings
- [ ] **Allowed Callback URLs** includes:
  - `http://localhost:3000/auth/callback`
  - `https://yourdomain.com/auth/callback` (for production)
- [ ] **Allowed Logout URLs** includes:
  - `http://localhost:3000`
  - `https://yourdomain.com` (for production)
- [ ] **Allowed Web Origins** includes:
  - `http://localhost:3000`
  - `https://yourdomain.com` (for production)

#### Social Connections (Authentication → Social)
- [ ] **Shop** enabled for your application (Shopify's Shop app)
  - Required scopes: `openid`, `profile`, `email`
- [ ] **Klarna** enabled for your application
  - Required scopes: `openid`, `profile`
- [ ] **PayPal** enabled for your application
  - Required scopes: `openid`, `profile`, `email`
- [ ] **Amazon** enabled for your application
  - Required scopes: `profile`, `postal_code`
- [ ] **Google OAuth2** enabled for your application
  - Required scopes: `https://www.googleapis.com/auth/calendar.events`, `https://www.googleapis.com/auth/gmail.readonly`
- [ ] **Discord** enabled for your application
  - Required scopes: `identify`, `email`

### 3. Code Implementation
- [x] Auth0 SDK v4 installed (`@auth0/nextjs-auth0@4.16.1`)
- [x] Middleware configured (`apps/web/middleware.ts`)
- [x] Auth0 client initialized (`apps/web/lib/auth0.ts`)
- [x] Token Vault service implemented (`apps/web/lib/services/token-vault.ts`)
- [x] Connected Accounts UI (`apps/web/components/ConnectedAccounts.tsx`)
- [x] API routes created:
  - `/api/auth/connect` — Initiate OAuth flow
  - `/api/auth/connected-accounts` — List connections
  - `/api/auth/revoke-connection` — Revoke access

## 🧪 Testing Steps

### Test 1: Basic Authentication
1. Start dev server: `pnpm dev`
2. Visit: http://localhost:3000
3. Click "Login" or navigate to `/auth/login`
4. Should redirect to Auth0 login page
5. After login, should redirect back to your app with session

### Test 2: Connected Accounts UI
1. While logged in, navigate to Settings → Connected Accounts
2. Should see 6 provider cards:
   - Shop (�️) — Shopify shopping data
   - Klarna (�) — Payment & wishlists
   - PayPal (�) — Transaction history
   - Amazon (�) — Shopping history
   - Google (📅) — Calendar & Gmail
   - Discord (�) — Community sharing
3. All should show "Connect" button (not connected yet)

### Test 3: OAuth Connection Flow
1. Click "Connect" on Google
2. Should redirect to Auth0 with Google OAuth consent screen
3. Grant permissions
4. Should redirect back to your app
5. Google card should now show "Connected" badge with "Revoke" button

### Test 4: Token Vault API
1. Make a test API call to `/api/agent/schedule-event` (if implemented)
2. Should successfully exchange token and call Google Calendar API
3. Check browser console for any errors

## 🚨 Common Issues

### Issue: 404 on `/auth/login`
**Cause**: Middleware not properly configured
**Fix**: Verify `apps/web/middleware.ts` exists and exports `auth0.middleware`

### Issue: "JWEDecryptionFailed" error
**Cause**: Invalid `AUTH0_SECRET` or old session cookie
**Fix**: 
1. Generate new secret: `openssl rand -hex 32`
2. Update `.env.local`
3. Clear browser cookies for localhost:3000
4. Restart dev server

### Issue: "Connection not found" when connecting
**Cause**: Social connection not enabled in Auth0 dashboard
**Fix**: Go to Authentication → Social → Enable the connection for your application

### Issue: "Unauthorized" when accessing connected accounts
**Cause**: Not logged in or session expired
**Fix**: Navigate to `/auth/login` first

### Issue: Cannot revoke connection
**Cause**: `AUTH0_MANAGEMENT_API_TOKEN` not set
**Fix**: Create Machine-to-Machine app in Auth0 with `read:users`, `update:users`, `delete:user_identities` permissions

## 📚 Resources

- [Auth0 Next.js SDK v4 Docs](https://auth0.com/docs/quickstart/webapp/nextjs/interactive)
- [Auth0 Token Vault Guide](https://auth0.com/docs/secure/tokens/token-vault)
- [RFC 8693 Token Exchange](https://datatracker.ietf.org/doc/html/rfc8693)
- [Auth0 Management API](https://auth0.com/docs/api/management/v2)

## ✅ Ready for Hackathon Submission

Once all checkboxes above are checked, your Token Vault integration is complete and ready for the "Authorized to Act" hackathon submission!

**Next Steps**:
1. Test the OAuth flow with at least one provider (Google recommended)
2. Verify token exchange works by making an API call
3. Document your implementation in the hackathon submission
4. Deploy to production and update callback URLs
