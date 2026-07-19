"use client";

import { useState, useCallback } from "react";
import {
  Copy,
  Check,
  MessageCircle,
  Instagram,
  Share2,
  QrCode,
  Download,
} from "lucide-react";
import { SafeImage } from "./SafeImage";

interface ShareKitProps {
  storefrontUrl: string;
  curatorName: string;
}

/**
 * Share kit for curators — gives them everything they need to share
 * their storefront link across platforms.
 *
 * - Copy link (with feedback)
 * - Share on WhatsApp (pre-written marketing copy)
 * - Share on Instagram story (pre-written caption + link to copy)
 * - Share via native share sheet (mobile)
 * - QR code (printable, scannable)
 */
export function ShareKit({ storefrontUrl, curatorName }: ShareKitProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const shareText = `Check out ${curatorName} on OnPoint — try on items with AI and shop direct! ${storefrontUrl}`;
  const igCaption = `${curatorName} on OnPoint — try before you buy with AI try-on. Tap the link in bio to see the collection.\n\n${storefrontUrl}`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(storefrontUrl);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = storefrontUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [storefrontUrl]);

  const handleWhatsApp = useCallback(() => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }, [shareText]);

  const handleInstagram = useCallback(() => {
    // Instagram doesn't support web share URLs — copy the caption
    // and open Instagram
    try {
      navigator.clipboard.writeText(igCaption);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = igCaption;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  }, [igCaption]);

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${curatorName} on OnPoint`,
          text: shareText,
          url: storefrontUrl,
        });
      } catch {
        // User cancelled
      }
    }
  }, [curatorName, shareText, storefrontUrl]);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(storefrontUrl)}`;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Share2 className="h-5 w-5 text-primary" />
        <h3 className="font-bold">Share your storefront</h3>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Get your link in front of customers. Put it in your WhatsApp status,
        Instagram bio, or print a QR code for your shop.
      </p>

      {/* Platform buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium transition-all hover:bg-muted active:scale-[0.98]"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-success" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy link
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleWhatsApp}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-success px-4 py-3 text-sm font-bold text-white transition-all hover:bg-success active:scale-[0.98]"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </button>

        <button
          type="button"
          onClick={handleInstagram}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium transition-all hover:bg-muted active:scale-[0.98]"
        >
          <Instagram className="h-4 w-4" />
          Instagram
        </button>

        <button
          type="button"
          onClick={() => setShowQR((v) => !v)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium transition-all hover:bg-muted active:scale-[0.98]"
        >
          <QrCode className="h-4 w-4" />
          QR code
        </button>
      </div>

      {/* Native share (mobile only) */}
      {"share" in navigator && (
        <button
          type="button"
          onClick={handleNativeShare}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium transition-all hover:bg-muted active:scale-[0.98]"
        >
          <Share2 className="h-4 w-4" />
          Share via phone
        </button>
      )}

      {/* QR code display */}
      {showQR && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-border bg-background p-4">
          <div className="relative h-48 w-48">
            <SafeImage
              sources={[qrUrl]}
              alt="QR code for your storefront"
              fill
              unoptimized
              className="rounded-lg"
            />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Print this and put it in your shop. Customers scan it to visit your
            storefront and try on items.
          </p>
          <a
            href={qrUrl}
            download={`${curatorName.toLowerCase().replace(/\s+/g, "-")}-qr.png`}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-medium transition-colors hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" />
            Download QR
          </a>
        </div>
      )}

      {/* Instagram caption helper */}
      <div className="mt-4 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Instagram tip:</p>
        Put your link in your bio, then post to your story with the caption:
        <p className="mt-2 italic">&ldquo;{igCaption}&rdquo;</p>
        <p className="mt-2">We&apos;ve copied this to your clipboard when you tap Instagram above.</p>
      </div>
    </div>
  );
}
