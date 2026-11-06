import { redirect } from "next/navigation";
import { getApiBase } from "@/lib/utils/api-base";

export const dynamic = "force-dynamic";

/**
 * Referral landing — /r/[referralCode]
 *
 * Server-side redirect (no spinner flash):
 * 1. `receipt_*` links predate /receipt/{id} — forward them untouched.
 * 2. POST the visit capture to the API; use its redirectUrl when provided.
 * 3. Forward with `?referral=<code>` so whichever surface lands next stores the
 *    code for the session (see lib/utils/share-attribution.ts).
 */
async function resolveDestination(referralCode: string): Promise<string> {
  try {
    const res = await fetch(`${getApiBase()}/api/referrals/capture`, {
      method: "POST",
      // Short budget: a slow API must not leave the visitor staring at a
      // blank redirect. Capture failure falls through to "/" below.
      signal: AbortSignal.timeout(1500),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        referralCode,
        action: "visit",
        timestamp: new Date().toISOString(),
      }),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.redirectUrl === "string" && data.redirectUrl) {
        return data.redirectUrl;
      }
    }
  } catch {
    /* capture failure must not strand the visitor */
  }
  return "/";
}

function withReferralParam(dest: string, code: string): string {
  if (!dest.startsWith("/")) return dest; // external destination — leave as-is
  const sep = dest.includes("?") ? "&" : "?";
  return `${dest}${sep}referral=${encodeURIComponent(code)}`;
}

export default async function ReferralPage({
  params,
}: {
  params: Promise<{ referralCode: string }>;
}) {
  const { referralCode } = await params;
  if (!referralCode) redirect("/");
  if (referralCode.startsWith("receipt_")) {
    redirect(`/receipt/${encodeURIComponent(referralCode)}`);
  }
  redirect(withReferralParam(await resolveDestination(referralCode), referralCode));
}
