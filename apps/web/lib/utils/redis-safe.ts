/**
 * Guards for values that end up inside Upstash REST URLs.
 *
 * Upstash's REST API treats every path segment as a command argument
 * (`/del/a/b` is `DEL a b`). Interpolating unvalidated input into such a path
 * therefore lets a caller add extra keys or arguments, e.g. a `paymentId` of
 * `x/curator:payments:wanja` turns a one-key DEL into one that also deletes a
 * curator's payment list. Prefer pipeline bodies (JSON) for anything
 * user-influenced; where a value must sit in the path, whitelist it first.
 */

const SAFE_SLUG = /^[a-z0-9-]{2,64}$/;

/** A curator slug that is safe to place in a Redis key and URL path. */
export function isSafeSlug(value: unknown): value is string {
  return typeof value === "string" && SAFE_SLUG.test(value);
}
