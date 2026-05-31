"use client";

import { useCallback, useRef, useState } from "react";
import { Check, Copy, ExternalLink, MessageCircle, Share2 } from "lucide-react";

interface ShareStorefrontProps {
  curatorSlug: string;
  curatorName: string;
  whatsappNumber?: string;
}

type ShareMethod = "whatsapp" | "copy" | "native";

/**
 * Share button for curator storefronts.
 * Fires `data-analytics-share-method` events for the CuratorTracker
 * to pick up via event delegation.
 */
export function ShareStorefront({
  curatorSlug,
  curatorName,
  whatsappNumber,
}: ShareStorefrontProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const storefrontUrl = `${window.location.origin}/s/${curatorSlug}`;
  const shareText = `Check out ${curatorName} on OnPoint — try on kits with AI and shop direct! ${storefrontUrl}`;

  const fireShare = useCallback(
    (method: ShareMethod) => {
      // Dispatch a custom event so the CuratorTracker picks it up
      document.dispatchEvent(
        new CustomEvent("curator-share", {
          detail: { method, curatorSlug },
        }),
      );
      // Also fire directly to the Redis analytics endpoint
      fetch("/api/curator/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "share",
          curatorSlug,
        }),
      }).catch(() => {});
    },
    [curatorSlug],
  );

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(storefrontUrl);
      setCopied(true);
      fireShare("copy");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = storefrontUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      fireShare("copy");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }
    setOpen(false);
  }, [storefrontUrl, fireShare]);

  const handleWhatsAppShare = useCallback(() => {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
    fireShare("whatsapp");
    setOpen(false);
  }, [shareText, fireShare]);

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${curatorName} on OnPoint`,
          text: shareText,
          url: storefrontUrl,
        });
        fireShare("native");
      } catch {
        // User cancelled — don't track
      }
    }
    setOpen(false);
  }, [curatorName, shareText, storefrontUrl, fireShare]);

  const handleDirectWhatsApp = useCallback(() => {
    fireShare("whatsapp");
    // The link will be followed natively by the <a> tag
  }, [fireShare]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        data-analytics-share-method="menu"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Share2 className="h-3.5 w-3.5" />
        Share
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {/* Copy link */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted"
          >
            {copied ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0">
              <p className="font-medium">{copied ? "Link copied!" : "Copy link"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {storefrontUrl}
              </p>
            </div>
          </button>

          {/* Share via WhatsApp */}
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted"
          >
            <MessageCircle className="h-4 w-4 shrink-0 text-emerald-500" />
            <div className="min-w-0">
              <p className="font-medium">Share via WhatsApp</p>
              <p className="text-xs text-muted-foreground">Send to a friend</p>
            </div>
          </button>

          {/* Native share (mobile) */}
          {"share" in navigator && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted"
            >
              <ExternalLink className="h-4 w-4 shrink-0 text-sky-500" />
              <div className="min-w-0">
                <p className="font-medium">Share with your phone</p>
                <p className="text-xs text-muted-foreground">Use system share sheet</p>
              </div>
            </button>
          )}

          {/* Message curator on WhatsApp (if number available) */}
          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber.replace(/^\+/, "")}?text=${encodeURIComponent(`Hi ${curatorName}, I saw your storefront on OnPoint and I'd like to know more.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleDirectWhatsApp}
              className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-left text-sm transition-colors hover:bg-muted"
            >
              <MessageCircle className="h-4 w-4 shrink-0 text-emerald-500" />
              <div className="min-w-0">
                <p className="font-medium">Message {curatorName}</p>
                <p className="text-xs text-muted-foreground">Chat on WhatsApp</p>
              </div>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
