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
  - Required scope for scheduling: `https://www.googleapis.com/auth/calendar.events`
  - Do not request `https://www.googleapis.com/auth/gmail.readonly` unless Gmail receipt ingestion is implemented and the Google OAuth app has completed the required Google verification.
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
  - `/api/auth/nonce` — Generate one-time SIWE nonce for wallet linking
  - `/api/auth/link-wallet` — Verify signed SIWE payload and link wallet to Auth0 user

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
   - Google (📅) — Calendar scheduling
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

### Test 5: Signed Wallet Linking
1. Sign in with Auth0.
2. Connect a wallet through MiniPay, RainbowKit, or WalletConnect.
3. Click "Link Account".
4. Confirm the SIWE signature in the wallet.
5. The app should call `/api/auth/link-wallet` with a signed message and signature, not a raw `walletAddress`.

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

### Issue: Google says "Access blocked: auth0.com has not completed the Google verification process"
**Cause**: Google is blocking the OAuth client before Auth0 redirects back to the app. This usually means the Google OAuth consent screen is still in Testing mode and the signed-in Gmail account is not listed as a test user, or the app is requesting sensitive/restricted Google scopes without completing Google's OAuth app verification.
**Fix**:
1. In Google Cloud Console, open the project used by the Auth0 Google social connection.
2. Go to APIs & Services → OAuth consent screen.
3. For local/testing use, keep Publishing status as Testing and add the Gmail account you are using, for example `your-email@gmail.com`, under Test users.
4. For production use, complete Google OAuth verification for every requested scope before making the app public.
5. In Auth0 → Authentication → Social → Google OAuth2, make sure the connection uses your verified Google OAuth client ID/secret, not a placeholder or unrelated test project.

### Issue: "Unauthorized" when accessing connected accounts
**Cause**: Not logged in or session expired
**Fix**: Navigate to `/auth/login` first

### Issue: Cannot revoke connection
**Cause**: `AUTH0_MANAGEMENT_API_TOKEN` not set
**Fix**: Create Machine-to-Machine app in Auth0 with `read:users`, `update:users`, `delete:user_identities` permissions

### Issue: Wallet link returns "Missing signed wallet link payload"
**Cause**: The client is still using the old address-only payload.
**Fix**: Fetch `/api/auth/nonce`, build a SIWE message, have the wallet sign it, then POST `{ message, signature }` to `/api/auth/link-wallet`.

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
