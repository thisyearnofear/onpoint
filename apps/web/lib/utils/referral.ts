const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function encode(n: number): string {
  if (n === 0) return BASE62[0]!;
  let result = "";
  while (n > 0) {
    result = BASE62[n % 62] + result;
    n = Math.floor(n / 62);
  }
  return result;
}

function decode(s: string): number {
  let n = 0;
  for (const c of s) {
    n = n * 62 + BASE62.indexOf(c);
  }
  return n;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h);
}

type ShareSource = "look_crafter" | "polaroid" | "curator_storefront" | "style_report";

const SOURCE_CODES: Record<ShareSource, number> = {
  look_crafter: 1,
  polaroid: 2,
  curator_storefront: 3,
  style_report: 4,
};

const CODE_TO_SOURCE: Record<number, ShareSource> = Object.fromEntries(
  Object.entries(SOURCE_CODES).map(([k, v]) => [v, k as ShareSource]),
) as Record<number, ShareSource>;

interface ReferralData {
  userId: string;
  source: ShareSource;
  persona?: string;
}

export function generateShareLink(
  userId: string,
  source: ShareSource,
  persona?: string,
): string {
  const userHash = encode(hashString(userId));
  const sourceCode = SOURCE_CODES[source];
  const ref = `${userHash}${sourceCode}${persona ? `p${persona.charAt(0)}` : ""}`;
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const url = new URL(base);
  url.searchParams.set("ref", ref);
  if (persona) url.searchParams.set("persona", persona);
  return url.toString();
}

export function parseReferralLink(raw: string): ReferralData | null {
  try {
    const url = new URL(raw);
    const ref = url.searchParams.get("ref");
    if (!ref || ref.length < 2) return null;

    const sourceDigit = parseInt(ref[ref.length - (ref.includes("p") ? 2 : 1)]!, 10);
    const source = CODE_TO_SOURCE[sourceDigit];
    if (!source) return null;

    const userId = ref.slice(0, ref.length - (ref.includes("p") ? 2 : 1));
    const personaMatch = ref.match(/p(.+)$/);
    const persona = personaMatch ? personaMatch[1] : undefined;

    return { userId, source, persona };
  } catch {
    return null;
  }
}

export function captureReferralFromURL(): void {
  if (typeof window === "undefined") return;
  const ref = new URLSearchParams(window.location.search).get("ref");
  if (ref) {
    sessionStorage.setItem("onpoint_referral", ref);
  }
}
