"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import {
  newShareId,
  withShareParams,
  type ShareChannel,
} from "@/lib/utils/share-attribution";

export function ShareArtifact({ title, text, url }: { title: string; text?: string; url: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const base = url.startsWith("http") ? url : `${window.location.origin}${url}`;
    // A fresh id per send: without it, an artifact share is indistinguishable
    // from any other visit when the try-on and order land.
    const mint = (channel: ShareChannel) => withShareParams(base, newShareId(), channel);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url: mint("native") });
        return;
      } catch {
        /* user dismissed or unsupported — fall back to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(mint("copy"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <button
      type="button"
      onClick={() => void share()}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 text-xs font-bold text-foreground transition-colors hover:border-foreground"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
      {copied ? "Link copied" : "Send it"}
    </button>
  );
}
