"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { newShareId } from "@/lib/utils/share-attribution";

/**
 * Was a copy of `/r/<curatorSlug>` — that route takes a `ref_*` referral code,
 * so the link landed on a page that could never resolve it. Shares this
 * polaroid with a fresh `sid` instead, which the order can be joined back to.
 */
export function ReferralCopyCta() {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("sid", newShareId());
    url.searchParams.set("utm_source", "copy");
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-warning/10 border border-warning/20">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/20">
        <Sparkles className="w-4 h-4 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-amber-300">Earn 2.5% per purchase</p>
        <p className="text-xs text-amber-400/70 truncate">
          Share this polaroid — when someone buys through your link, you earn commission
        </p>
      </div>
      <button
        type="button"
        onClick={copyLink}
        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/20 hover:bg-warning/30 text-xs font-bold text-amber-300 transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5" aria-hidden /> : null}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
