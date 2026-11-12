/**
 * Reading the try-on endpoint's rate-limit state. The API enforces two
 * fixed windows per visitor IP — five requests a minute, then twenty a
 * day — and reports them through `Retry-After`/`retryAfter` on a 429 and
 * `X-RateLimit-*` headers otherwise. Since the daily limiter runs last,
 * the headers on a non-429 response describe the daily window.
 */
export type LimitKind = "breather" | "daily";

/** Under ~90s it's the minute window; anything longer is the daily cap. */
export function classifyLimit(retryAfterSec: number): LimitKind {
  return retryAfterSec <= 90 ? "breather" : "daily";
}

export function formatWait(sec: number): string {
  const s = Math.max(1, Math.round(sec));
  if (s < 60) return `${s}s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r ? `${m}m ${r}s` : `${m}m`;
  }
  // Hours: round the remaining minutes up — "11h 43.9m" reads "11h 44m".
  const totalMin = Math.ceil(s / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Rough looks remaining on the daily window. Only meaningful when the
 * headers describe the daily limiter (limit 20); each look costs about
 * two requests (quote + check), so halve the remaining count. A limit
 * that isn't 20 — e.g. a minute-window header — says nothing here.
 */
export function looksLeft(remaining: number | null, limit: number | null): number | null {
  if (limit !== 20 || typeof remaining !== "number" || !Number.isFinite(remaining)) return null;
  return Math.max(0, Math.floor(remaining / 2));
}

export function readLimit(
  headers: Headers,
  body: unknown,
): { retryAfterSec: number | null; remaining: number | null; limit: number | null } {
  const num = (v: string | null): number | null => {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  let retryAfterSec: number | null = null;
  if (body && typeof body === "object") {
    const ra = (body as Record<string, unknown>).retryAfter;
    if (typeof ra === "number" && Number.isFinite(ra)) retryAfterSec = ra;
  }
  if (retryAfterSec == null) retryAfterSec = num(headers.get("retry-after"));
  return {
    retryAfterSec,
    remaining: num(headers.get("x-ratelimit-remaining")),
    limit: num(headers.get("x-ratelimit-limit")),
  };
}
