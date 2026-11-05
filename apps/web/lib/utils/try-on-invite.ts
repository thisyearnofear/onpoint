import { createHmac, timingSafeEqual } from "crypto";

export interface TryOnInvite {
  curatorSlug: string;
  listingId: string;
  note?: string;
  senderName?: string;
  exp: number;
}

const SECRET =
  process.env.TRYON_INVITE_SECRET || process.env.AUTH0_SECRET || "dev-invite-secret";

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function createInviteToken(inv: Omit<TryOnInvite, "exp">, ttlMs = 7 * 24 * 3600 * 1000): string {
  const payload = b64url(JSON.stringify({ ...inv, exp: Date.now() + ttlMs }));
  return `${payload}.${sign(payload)}`;
}

export function verifyInviteToken(token: string): TryOnInvite | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const inv = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!inv.curatorSlug || !inv.listingId || inv.exp < Date.now()) return null;
    return inv;
  } catch {
    return null;
  }
}
