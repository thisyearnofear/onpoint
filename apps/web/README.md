This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Origin Trial (Chrome Built‑in AI)

If you plan to use Chrome’s Built‑in AI APIs from the web app (not the extension), you can enable an Origin Trial token via an HTTP header. Support is already wired in `next.config.js`:

1. Obtain an Origin Trial token for the feature from Chrome’s Origin Trials.
2. Create `.env.local` at the project root and set:
   
   ```env
   ORIGIN_TRIAL_TOKEN=your_token_here
   ```
3. Start the dev server. The app will send `Origin-Trial: <token>` for all routes.
4. Verify in DevTools → Network tab → any request → Headers.

Note: The Chrome extension does not require Origin Trials; it accesses Built‑in AI directly within the extension context when available on the device.

## Farcaster Mini App Integration

This app is integrated with Farcaster Mini Apps per the 2025 specification:

- SDK: `@farcaster/miniapp-sdk` initialized in `app/providers.tsx` with `sdk.actions.ready()`.
- Embed metadata: `fc:miniapp` and `fc:frame` meta tags added in `app/layout.tsx`.
- Manifest: Served at `/.well-known/farcaster.json` via Next route, built from env vars.
- Sign-in: Minimal Farcaster sign-in button (`components/FarcasterSignInButton.tsx`).
- Notifications: Webhook placeholder at `app/api/webhook/route.ts`.

### Required Environment Variables

Create `apps/web/.env.local` and set:

```
NEXT_PUBLIC_URL=https://your-domain.example
NEYNAR_API_KEY=your_neynar_api_key
FARCASTER_ACCOUNT_ASSOCIATION_JSON={"signature":"...","account":"..."}
NEYNAR_WEBHOOK_SECRET=optional_shared_secret_for_webhook_validation
```

`NEXT_PUBLIC_URL` must be an HTTPS domain reachable by Farcaster clients (use a tunnel like ngrok for local testing).

### Claim Manifest Ownership

1. Deploy and ensure `https://your-domain/.well-known/farcaster.json` returns the manifest.
2. Open the Farcaster Manifest Tool and claim ownership for your domain.
3. Paste the generated `accountAssociation` JSON into `FARCASTER_ACCOUNT_ASSOCIATION_JSON` env.

### Notes

- Images used in embeds should be 3:2 aspect ratio and served with proper `image/*` content-type.
- When running inside a Mini App host, the sign-in button appears and the splash screen is hidden after `ready()`.
- For wallet integrations inside Mini Apps, consider `@farcaster/miniapp-wagmi-connector` with wagmi.

### Social API routes

- `POST /api/social/signer` — create Neynar managed signer (returns `signer_uuid`, `signer_approval_url`).
- `POST /api/social/cast` — publish a cast using `signerUuid`.
- `POST /api/social/reaction` — like or recast a cast.
- `GET  /api/social/search?q=...` — search Farcaster users.
- `POST /api/webhook` — inbound notifications (optional HMAC validation via `NEYNAR_WEBHOOK_SECRET`).
