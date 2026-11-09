"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, Link2, MessageCircle, Send, Share2, X } from "lucide-react";
import { newShareId, withShareParams, type ShareChannel } from "@/lib/utils/share-attribution";
import { celebrateFirst } from "./firsts";

function vibrate(p: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(p);
  } catch {
    /* noop */
  }
}

async function logShare(channel: ShareChannel, url: string, sid: string, lookSlug?: string | null) {
  // Count the share in the funnel (joined downstream by sid).
  void fetch("/api/loop/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "artifact_shared",
      meta: { channel, path: url, shareId: sid, lookSlug: lookSlug || undefined },
    }),
  }).catch(() => undefined);
  if (lookSlug) {
    const { postLookEvent } = await import("@/lib/utils/share-attribution");
    postLookEvent(lookSlug, "share", { shareId: sid, channel });
  }
}

/**
 * Channel-aware share: WhatsApp / X / Farcaster / native / copy, plus
 * Instagram-ready image download when `imageUrl` is provided.
 * Replaces the generic "Send it" fallback with measurable channels.
 */
export function ShareSheet({
  title,
  text,
  url,
  imageUrl,
  lookSlug,
  label = "Share",
  onShare,
}: {
  title: string;
  text?: string;
  url: string;
  imageUrl?: string | null;
  lookSlug?: string | null;
  label?: string;
  onShare?: (channel: ShareChannel, url: string, sid: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const mint = (channel: ShareChannel) => {
    const base = url.startsWith("http") ? url : `${window.location.origin}${url}`;
    const sid = newShareId();
    const attributed = withShareParams(base, sid, channel);
    onShare?.(channel, attributed, sid);
    void logShare(channel, url, sid, lookSlug);
    celebrateFirst("share");
    vibrate(10);
    return { attributed, sid };
  };

  const sendNative = async () => {
    const { attributed } = mint("native");
    try {
      await navigator.share({ title, text, url: attributed });
      setOpen(false);
    } catch {
      /* dismissed — stay open */
    }
  };

  const copyLink = async () => {
    const { attributed } = mint("copy");
    try {
      await navigator.clipboard.writeText(attributed);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const castToFarcaster = () => {
    const { attributed } = mint("other");
    const msg = `${title} ${attributed}`;
    window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const downloadImage = async () => {
    if (!imageUrl) return;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "onpoint-look.jpg";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const openChannel = (channel: "whatsapp" | "twitter") => {
    const { attributed } = mint(channel);
    const msg = `${title}${text ? ` — ${text}` : ""} ${attributed}`;
    const href =
      channel === "whatsapp"
        ? `https://wa.me/?text=${encodeURIComponent(msg)}`
        : `https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}`;
    window.open(href, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 text-xs font-bold text-foreground transition-colors hover:border-foreground active:scale-95"
      >
        <Share2 className="h-3.5 w-3.5" />
        {label}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-label="Share"
          >
            <motion.div
              initial={{ y: 24, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 16, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-border bg-background p-4 shadow-2xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold">Share this look</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close share"
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openChannel("whatsapp")}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#25D366]/15 px-3 text-xs font-bold text-foreground transition-transform hover:scale-[1.02] active:scale-95"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => openChannel("twitter")}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-foreground/5 px-3 text-xs font-bold transition-transform hover:scale-[1.02] active:scale-95"
                >
                  <Send className="h-4 w-4" />X
                </button>
                <button
                  type="button"
                  onClick={castToFarcaster}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-purple-500/15 px-3 text-xs font-bold transition-transform hover:scale-[1.02] active:scale-95"
                >
                  <span className="text-sm">🟪</span>
                  Farcaster
                </button>
                {typeof navigator !== "undefined" && "share" in navigator ? (
                  <button
                    type="button"
                    onClick={() => void sendNative()}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary/10 px-3 text-xs font-bold text-primary transition-transform hover:scale-[1.02] active:scale-95"
                  >
                    <Share2 className="h-4 w-4" />
                    More…
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary/10 px-3 text-xs font-bold text-primary transition-transform hover:scale-[1.02] active:scale-95"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                    {copied ? "Copied!" : "Copy link"}
                  </button>
                )}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                  {copied ? "Copied!" : "Copy link"}
                </button>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => void downloadImage()}
                    className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {downloaded ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                    {downloaded ? "Saved!" : "IG image"}
                  </button>
                )}
              </div>

              <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
                Your link earns <span className="font-bold text-foreground">2.5%</span> when someone buys.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
