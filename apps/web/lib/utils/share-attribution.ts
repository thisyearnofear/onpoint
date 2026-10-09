/**
 * Client helpers for the look-share growth loop (docs/ops/growth-loop.md).
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
const REFERRAL_RE = /^[A-Za-z0-9_-]{3,64}$/;
const REFERRAL_KEY = "onpoint_referral_code";
/** Key written by the /r/[referralCode] landing page. */
const LANDING_REFERRAL_KEY = "referral_code";

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

/**
 * Remember a `?referral=<code>` from the URL for the session. Independent of
 * the share id: a referral link may arrive without one.
 */
function captureReferralFromUrl(params: URLSearchParams): void {
  const raw = params.get("referral") || "";
  if (!REFERRAL_RE.test(raw)) return;
  try {
    sessionStorage.setItem(REFERRAL_KEY, raw);
  } catch {
    /* storage may be blocked */
  }
}

/** The referral code for this session, from the URL capture or the /r landing page. */
export function getReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    for (const key of [REFERRAL_KEY, LANDING_REFERRAL_KEY]) {
      const value = sessionStorage.getItem(key);
      if (value && REFERRAL_RE.test(value)) return value;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Read sid/utm_source from the current URL; persist for the session. */
export function captureShareAttribution(): ShareAttribution {
  if (typeof window === "undefined") return { sid: null, channel: "direct" };
  const params = new URLSearchParams(window.location.search);
  captureReferralFromUrl(params);
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
 * join the outcome to the originating share and referrer. Empty when neither
 * is known.
 */
export function getAttributionFields(): {
  shareId?: string;
  lookSlug?: string;
  referralCode?: string;
} {
  const a = getShareAttribution();
  const referralCode = getReferralCode();
  return {
    ...(a.sid && a.look ? { shareId: a.sid, lookSlug: a.look } : {}),
    // Stored on the order for attribution only; no commission is created.
    ...(referralCode ? { referralCode } : {}),
  };
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
