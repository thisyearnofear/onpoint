"use client";

import { useState } from "react";
import { Share2, Copy, Check, MessageCircle } from "lucide-react";

interface Props {
  item: string;
  curatorName: string;
  score?: number | null;
}

export function PolaroidShareButtons({ item, curatorName, score }: Props) {
  const [copied, setCopied] = useState(false);

  const shareText = score
    ? `My AI try-on of ${item} by ${curatorName} scored ${score}/10 on OnPoint!`
    : `Check out my AI try-on of ${item} by ${curatorName} on OnPoint!`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not available
    }
  };

  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}`)}`;

  return (
    <div className="flex items-center gap-2">
      <a
        href={xUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 flex-1 bg-muted/30 hover:bg-muted/50 text-foreground border border-border/50 rounded-full py-2.5 text-xs font-bold transition-colors"
      >
        <Share2 className="w-3.5 h-3.5" />
        Share
      </a>
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center w-10 h-10 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-full transition-colors"
        aria-label="Share on WhatsApp"
      >
        <MessageCircle className="w-3.5 h-3.5" />
      </a>
      <button
        onClick={handleCopy}
        className="flex items-center justify-center w-10 h-10 bg-muted/30 hover:bg-muted/50 text-muted-foreground border border-border/50 rounded-full transition-colors"
        aria-label="Copy link"
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
