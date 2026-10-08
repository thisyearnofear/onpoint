/**
 * Client helpers for the look-share growth loop (docs/guides/growth-loop.md).
 * Share links carry `sid` (share id) and `utm_source` (channel). The landing
 * page stores them for the session and reports visits/CTA clicks to the API.
 */
import { getApiBase } from "./api-base";

export type ShareChannel =
  | "copy"
  | "native"
  | "twitter"
  | "whatsapp"
  | "chatgpt"
  | "agent"
  | "direct"
  | "other";

const STORAGE_KEY = "onpoint_share";
const SID_RE = /^[a-z0-9]{6,16}$/;
const LOOK_RE = /^[a-z0-9-]{2,120}$/;

export interface ShareAttribution {
  sid: string | null;
  channel: string;
  /** Slug of the look the visitor came from (`look` query param). */
  look?: string | null;
}

/** 12 hex chars, matches the server's sanitizeShareId. */
export function newShareId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Append attribution params to a share URL. */
export function withShareParams(
  url: string,
  sid: string,
  channel: ShareChannel,
): string {
  const u = new URL(url);
  u.searchParams.set("sid", sid);
  u.searchParams.set("utm_source", channel);
  return u.toString();
}

/** Read sid/utm_source from the current URL; persist for the session. */
export function captureShareAttribution(): ShareAttribution {
  if (typeof window === "undefined") return { sid: null, channel: "direct" };
  const params = new URLSearchParams(window.location.search);
  const rawSid = (params.get("sid") || "").toLowerCase();
  if (SID_RE.test(rawSid)) {
    const rawLook = params.get("look") || "";
    const prev = getShareAttribution();
    const attribution: ShareAttribution = {
      sid: rawSid,
      channel: params.get("utm_source") || (prev.sid === rawSid ? prev.channel : "direct"),
      // The look page has no `look` param (its slug is the path); the
      // storefront gets it from the CTA link. Keep whichever we know.
      look: LOOK_RE.test(rawLook) ? rawLook : prev.sid === rawSid ? prev.look ?? null : null,
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
    } catch {
      /* storage may be blocked; attribution still applies to this page */
    }
    return attribution;
  }
  return getShareAttribution();
}

export function getShareAttribution(): ShareAttribution {
  if (typeof window === "undefined") return { sid: null, channel: "direct" };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ShareAttribution;
      if (parsed.sid && SID_RE.test(parsed.sid)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return { sid: null, channel: "direct" };
}

/** Fire-and-forget POST to a look event endpoint; never throws. */
export function postLookEvent(
  lookSlug: string,
  event: "share" | "visit" | "cta" | "storefront",
  body: Record<string, unknown>,
): void {
  const url = `${getApiBase()}/api/looks/${encodeURIComponent(lookSlug)}/${event}`;
  try {
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true, // survives navigation when a CTA click leaves the page
    }).catch(() => {});
  } catch {
    /* tracking must never break the UI */
  }
}

/**
 * Fields to merge into a payment or try-on request body so the server can
 * join the outcome to the originating share. Empty when not share-attributed.
 */
export function getAttributionFields(): { shareId?: string; lookSlug?: string } {
  const a = getShareAttribution();
  if (!a.sid || !a.look) return {};
  return { shareId: a.sid, lookSlug: a.look };
}

/**
 * Report a storefront step (arrive / tryon / buy / order) for a visitor who
 * came from a shared look. No-op without a share id and look slug.
 */
export function reportStorefrontEvent(
  kind: "arrive" | "tryon" | "buy" | "order",
): void {
  const a = getShareAttribution();
  if (!a.sid || !a.look) return;
  postLookEvent(a.look, "storefront", {
    kind,
    shareId: a.sid,
    channel: a.channel,
  });
}
