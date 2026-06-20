/**
 * Canonical base URL for the deployed app.
 *
 * Order of precedence (first non-empty wins):
 *   1. NEXT_PUBLIC_URL  — explicit override, exposed to the client
 *   2. APP_BASE_URL     — server-side override
 *   3. AUTH0_BASE_URL   — used by Auth0 callbacks; safe to reuse
 *   4. VERCEL_URL       — Vercel sets this on deploy
 *   5. URL              — Netlify sets this to the canonical site URL
 *                         (e.g. https://beonpoint.netlify.app)
 *   6. DEPLOY_PRIME_URL — Netlify branch-deploy URL
 *   7. fallback         — https://beonpoint.netlify.app
 *
 * Used by:
 *   - Root layout metadata (og:url, metadataBase)
 *   - Cron-generated emails (dashboard links)
 *   - Payment receipts (return URLs, "view transaction" links)
 *   - Farcaster embed (frame URL)
 *
 * Keep in sync with the canonical deployment URL. If you add a custom
 * domain later, set NEXT_PUBLIC_URL=https://yourdomain.com in Netlify's
 * env config and the chain picks it up automatically.
 */

export function getBaseUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_URL,
    process.env.APP_BASE_URL,
    process.env.AUTH0_BASE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
    process.env.URL, // Netlify canonical URL — already includes scheme
    process.env.DEPLOY_PRIME_URL, // Netlify branch deploy — already includes scheme
  ];

  for (const c of candidates) {
    if (c && c.trim().length > 0) return c.replace(/\/+$/, "");
  }

  return "https://beonpoint.netlify.app";
}

export const CANONICAL_BASE_URL = getBaseUrl();