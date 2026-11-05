"use client";

import { useState } from "react";
import { Share2, Copy, Check, MessageCircle } from "lucide-react";
import {
  newShareId,
  withShareParams,
  type ShareChannel,
} from "@/lib/utils/share-attribution";

interface Props {
  item: string;
  curatorName: string;
  score?: number | null;
}

/**
 * Every share mints its own id off a clean copy of this URL. Re-sharing
 * `window.location.href` as-is would hand the next person the `?sid=` that was
 * pointed at *them*, and the funnel would credit the wrong sharer for ever.
 */
function shareUrl(channel: ShareChannel): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  return withShareParams(url.toString(), newShareId(), channel);
}

const BUTTON =
  "flex items-center justify-center gap-1.5 rounded-full border border-border/50 bg-muted/30 py-2.5 text-xs font-bold text-foreground transition-colors hover:bg-muted/50";
const ROUND =
  "flex h-10 w-10 items-center justify-center rounded-full border transition-colors";

export function PolaroidShareButtons({ item, curatorName, score }: Props) {
  const [copied, setCopied] = useState(false);

  const shareText = score
    ? `My AI try-on of ${item} by ${curatorName} scored ${score}/10 on OnPoint!`
    : `Check out my AI try-on of ${item} by ${curatorName} on OnPoint!`;

  const openIntent = (base: string, params: string) => {
    window.open(`${base}?${params}`, "_blank", "noopener,noreferrer");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl("copy"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not available
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() =>
          openIntent(
            "https://twitter.com/intent/tweet",
            `text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl("twitter"))}`,
          )
        }
        className={`${BUTTON} flex-1`}
      >
        <Share2 className="w-3.5 h-3.5" />
        Share
      </button>
      <button
        type="button"
        onClick={() =>
          openIntent(
            "https://wa.me/",
            `text=${encodeURIComponent(`${shareText} ${shareUrl("whatsapp")}`)}`,
          )
        }
        aria-label="Share on WhatsApp"
        className={`${ROUND} border-success/20 bg-success/10 text-emerald-400 hover:bg-success/20`}
      >
        <MessageCircle className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => void handleCopy()}
        aria-label="Copy link"
        className={`${ROUND} border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/50`}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}
