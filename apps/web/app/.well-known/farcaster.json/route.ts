import { NextResponse } from 'next/server';

/**
 * Farcaster Mini App Manifest
 * - Aligns with 2025 Mini App discovery and ownership
 * - Uses env-driven single source of truth
 */
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_URL || '';
  const name = process.env.NEXT_PUBLIC_APP_NAME || 'BeOnPoint';
  const iconUrl = `${baseUrl}/assets/1Product.png`;

  // Account association JSON (paste from Farcaster Manifest Tool)
  // Expected to be a JSON string in env, e.g. { "signature": "...", "account":"..." }
  let accountAssociation: any = null;
  const assoc = process.env.FARCASTER_ACCOUNT_ASSOCIATION_JSON;
  if (assoc) {
    try {
      accountAssociation = JSON.parse(assoc);
    } catch {
      // keep null if invalid JSON
    }
  }

  const manifest = {
    name,
    url: baseUrl,
    icon: iconUrl,
    accountAssociation,
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
}