# Auth & Wallet Setup Guide

## Auth0 Configuration

### Environment Variables

```env
AUTH0_DOMAIN=dev-epemgbox1ty8vjf8.uk.auth0.com
AUTH0_CLIENT_ID=<your-client-id>
AUTH0_CLIENT_SECRET=<your-client-secret>
AUTH0_SECRET=<64-char-secret>  # openssl rand -hex 32
AUTH0_BASE_URL=http://localhost:3000
AUTH0_MANAGEMENT_API_TOKEN=<optional-for-revocation>
```

### Dashboard Settings

Visit: https://manage.auth0.com/dashboard/us/dev-epemgbox1ty8vjf8/

**Allowed URLs:**
- Callback: `http://localhost:3000/auth/callback`, `https://yourdomain.com/auth/callback`
- Logout: `http://localhost:3000`, `https://yourdomain.com`
- Web Origins: `http://localhost:3000`, `https://yourdomain.com`

**Social Connections:**
- Google OAuth2 (scope: `https://www.googleapis.com/auth/calendar.events`)
- GitHub (scopes: `repo`, `gist`)
- Slack (scopes: `chat:write`, `channels:read`)
- Microsoft (scopes: `Calendars.ReadWrite`, `Files.Read`)

### Code Implementation

- `apps/web/middleware.ts` — Auth0 middleware
- `apps/web/lib/auth0.ts` — Auth0 client
- `apps/web/lib/services/token-vault.ts` — Token Vault service
- `apps/web/components/ConnectedAccounts.tsx` — Connected accounts UI

### API Routes

| Route | Purpose |
|-------|---------|
| `/api/auth/connect` | Initiate OAuth flow |
| `/api/auth/connected-accounts` | List connections |
| `/api/auth/revoke-connection` | Revoke access |
| `/api/auth/nonce` | Generate SIWE nonce |
| `/api/auth/link-wallet` | Verify SIWE and link wallet |

### Troubleshooting

**404 on `/auth/login`:** Verify `apps/web/middleware.ts` exports `auth0.middleware`

**JWEDecryptionFailed:** Generate new secret (`openssl rand -hex 32`), clear cookies, restart

**Google blocked:** Add your Gmail as test user in Google Cloud Console → OAuth consent

---

## Agent Wallet Setup

### Security Principles

1. Never commit private keys to git (`.env.local` is in `.gitignore`)
2. Never log private keys
3. Use separate wallets for agent vs personal
4. Minimal funding — only keep necessary funds
5. Consider periodic key rotation

### Generate New Wallet

```bash
cd apps/web
node scripts/generate-agent-wallet.mjs
```

### Environment Configuration

```env
AGENT_PRIVATE_KEY=0x<64-hex-characters>
```

### Validation

```bash
node scripts/check-agent-wallet.mjs
```

### ERC-8004 Registration

```bash
cd apps/web
node scripts/register-erc8004-agent.mjs
```

### Security Checklist

- [ ] `.env.local` is in `.gitignore`
- [ ] Private key is 66 characters (0x + 64 hex)
- [ ] Wallet has sufficient CELO (0.1+ recommended)
- [ ] Private key stored in password manager
- [ ] No private keys in committed code or logs

### Wallet Rotation

1. Generate new wallet: `node scripts/generate-agent-wallet.mjs`
2. Update `.env.local` with new private key
3. Update `apps/web/config/chains.ts` with new address
4. Transfer remaining funds
5. Re-register on ERC-8004

### Production Notes

- Use environment variables instead of .env files
- Consider secrets manager (AWS Secrets Manager, HashiCorp Vault)
- Separate wallets for dev/staging/prod
- Monitor balance and set up alerts

---

## Resources

- [Auth0 Next.js SDK v4](https://auth0.com/docs/quickstart/webapp/nextjs/interactive)
- [Auth0 Token Vault](https://auth0.com/docs/secure/tokens/token-vault)
- [ERC-8004 Specification](https://eips.ethereum.org/EIPS/eip-8004)
- [8004scan Explorer](https://8004scan.io/)
