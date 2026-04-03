import { NextResponse } from "next/server";

/**
 * Allowed origins for CORS
 * In production, only these domains can access the API
 */
const ALLOWED_ORIGINS = [
  // Production domains
  "https://beonpoint.netlify.app",
  "https://onpoint-web-647723858538.us-central1.run.app",
  "https://onpoint.xyz",
  "https://www.onpoint.xyz",
  "https://app.onpoint.xyz",
  // Farcaster Mini App frame contexts
  "https://farcaster.xyz",
  "https://farcaster.com",
  "https://warpcast.com",
  // Development (only in non-production)
  ...(process.env.NODE_ENV !== "production"
    ? ["http://localhost:3000", "http://localhost:3001"]
    : []),
];

/**
 * Check if an origin is allowed.
 * In production, only explicitly listed origins are permitted.
 */
function isAllowedOrigin(origin: string): boolean {
  return (
    ALLOWED_ORIGINS.includes(origin) ||
    // Allow environment-specific origin
    process.env.NEXT_PUBLIC_APP_URL === origin
  );
}

export function corsHeaders(origin?: string): Record<string, string> {
  // In production, restrict to allowed origins
  // In development, allow all for easier testing
  const isProduction = process.env.NODE_ENV === "production";

  let allowedOrigin = "*";

  if (isProduction && origin) {
    allowedOrigin = isAllowedOrigin(origin) ? origin : "null";
  } else if (!isProduction && origin) {
    // Development: allow specific origins or localhost
    allowedOrigin = origin.includes("localhost")
      ? origin
      : ALLOWED_ORIGINS[0] || "*";
  }

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    // Security headers
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

export function jsonCors(data: unknown, status: number = 200, origin?: string) {
  return NextResponse.json(data, {
    status,
    headers: corsHeaders(origin),
  });
}
