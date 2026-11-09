"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import {
  newShareId,
  withShareParams,
  type ShareChannel,
} from "@/lib/utils/share-attribution";

export function ShareArtifact({
  title,
  text,
  url,
  onShare,
}: {
  title: string;
  text?: string;
  url: string;
  /** Extra attribution hook — called with (channel, attributedUrl, sid) per send. */
  onShare?: (channel: ShareChannel, url: string, sid: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const base = url.startsWith("http") ? url : `${window.location.origin}${url}`;
    // A fresh id per send: without it, an artifact share is indistinguishable
    // from any other visit when the try-on and order land.
    const mint = (channel: ShareChannel) => {
      const sid = newShareId();
      const attributed = withShareParams(base, sid, channel);
      onShare?.(channel, attributed, sid);
      return { attributed, sid };
    };
    // Count the share itself — conversions are joined downstream by sid,
    // but share volume needs its own event to exist in the funnel at all.
    // `sid` rides along so the API can record a look_share row: without it
    // the minted id is unknown to the funnel and every downstream join drops.
    const log = (channel: ShareChannel, sid: string) =>
      fetch("/api/loop/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "artifact_shared", meta: { channel, path: url, shareId: sid } }),
      }).catch(() => undefined);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        const { attributed, sid } = mint("native");
        await navigator.share({ title, text, url: attributed });
        void log("native", sid);
        return;
      } catch {
        /* user dismissed or unsupported — fall back to copy */
      }
    }
    try {
      const { attributed, sid } = mint("copy");
      await navigator.clipboard.writeText(attributed);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      void log("copy", sid);
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
