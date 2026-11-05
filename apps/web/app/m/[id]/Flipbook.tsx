"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MagazineData } from "./page";

interface Page {
  key: string;
  node: React.ReactNode;
}

export function Flipbook({ mag }: { mag: MagazineData }) {
  const pages: Page[] = [];

  // Cover — she's the star
  pages.push({
    key: "cover",
    node: (
      <div className="flex h-full flex-col bg-card p-8 text-center">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-primary">Issue Nº {mag.issue || 1}</p>
        <div className="flex flex-1 items-center justify-center py-6">
          {mag.photoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={mag.photoUrl} alt={mag.recipientName || "The cover star"} className="max-h-full max-w-full border border-border object-contain" />
          ) : (
            <div className="border border-border bg-muted/40 px-10 py-16">
              <p className="font-display text-3xl italic text-foreground/70">{mag.recipientName || "you"}</p>
            </div>
          )}
        </div>
        <h1 className="font-display text-4xl leading-[1.05] tracking-[-0.02em]">
          {mag.recipientName ? `For ${mag.recipientName}.` : "For you."}
        </h1>
        {mag.senderName && <p className="mt-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">by {mag.senderName}</p>}
      </div>
    ),
  });

  // Item spreads — two per page
  const items = mag.items || [];
  for (let i = 0; i < items.length; i += 2) {
    const pair = items.slice(i, i + 2);
    pages.push({
      key: `spread-${i}`,
      node: (
        <div className="flex h-full flex-col bg-card p-8">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
            The pieces · {i / 2 + 1}
          </p>
          <div className="grid flex-1 grid-rows-2 gap-4 py-4">
            {pair.map((item) => (
              <div key={item.listingId} className="relative flex min-h-0 items-center gap-4 border border-border p-4">
                {item.listingId === mag.heroListingId && (
                  <span className="absolute -top-2 right-3 border border-primary/40 bg-primary px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-white">
                    Picked for you
                  </span>
                )}
                {item.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={item.imageUrl} alt={item.title || "Piece"} className="h-20 w-20 shrink-0 border border-border object-cover" />
                ) : (
                  <div className="h-20 w-20 shrink-0 border border-border bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{item.title || "The piece"}</p>
                  <div className="mt-2 flex gap-2">
                    <Link href={`/lab?tab=try-on&from=mag&item=${item.listingId}`} className="inline-flex min-h-9 items-center rounded-full bg-primary px-3 text-xs font-bold text-white">
                      Try it on
                    </Link>
                    {item.curatorSlug && (
                      <Link href={`/s/${item.curatorSlug}?item=${item.listingId}`} className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-xs font-bold text-foreground hover:border-foreground">
                        Get it
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  // Back cover — the note + the return path
  pages.push({
    key: "back",
    node: (
      <div className="flex h-full flex-col bg-card p-8 text-center">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">The last page</p>
        <div className="flex flex-1 flex-col items-center justify-center">
          {mag.note ? (
            <p className="font-display text-2xl italic leading-snug text-foreground">&ldquo;{mag.note}&rdquo;</p>
          ) : (
            <p className="font-display text-2xl italic text-foreground/70">Made for you.</p>
          )}
          {mag.senderName && <p className="mt-4 text-xs font-bold text-muted-foreground">— {mag.senderName}</p>}
        </div>
        <Link href={`/magazine?reply=${mag.id}`} className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-8 text-sm font-bold text-white hover:bg-primary/90">
          Send one back
        </Link>
      </div>
    ),
  });

  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [hintDone, setHintDone] = useState(false);
  const touchX = React.useRef<number | null>(null);
  const total = pages.length;
  const flip = useCallback((d: number) => {
    setHintDone(true);
    setIndex((i) => {
      const next = Math.min(Math.max(i + d, 0), total - 1);
      if (next !== i) setDir(d);
      return next;
    });
  }, [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") flip(1);
      if (e.key === "ArrowLeft") flip(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flip]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md" style={{ perspective: "1600px" }}>
        <div
          className="relative aspect-[3/4] w-full overflow-hidden rounded-sm border border-border shadow-2xl shadow-black/20"
          onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
          onTouchEnd={(e) => {
            if (touchX.current == null) return;
            const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current;
            if (Math.abs(dx) > 40) flip(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          <AnimatePresence mode="popLayout" custom={dir}>
            <motion.div
              key={pages[index]!.key}
              custom={dir}
              initial={{ rotateY: dir > 0 ? 70 : -70, x: dir > 0 ? 60 : -60, opacity: 0.6 }}
              animate={
                index === 0 && !hintDone
                  ? { rotateY: [0, -14, 0], x: 0, opacity: 1 }
                  : { rotateY: 0, x: 0, opacity: 1 }
              }
              onAnimationComplete={() => { if (index === 0 && !hintDone) setHintDone(true); }}
              exit={{ rotateY: dir > 0 ? -70 : 70, x: dir > 0 ? -60 : 60, opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: "left center", transformStyle: "preserve-3d" }}
              className="absolute inset-0"
            >
              {pages[index]!.node}
            </motion.div>
          </AnimatePresence>

          <button type="button" aria-label="Previous page" onClick={() => flip(-1)} disabled={index === 0}
            className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-border bg-background/80 p-2 text-foreground backdrop-blur transition-opacity hover:border-foreground disabled:opacity-20">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Next page" onClick={() => flip(1)} disabled={index === total - 1}
            className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-border bg-background/80 p-2 text-foreground backdrop-blur transition-opacity hover:border-foreground disabled:opacity-20">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-4 text-center font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {index + 1} of {total} — swipe, tap the edges, or arrow keys
        </p>
      </div>
    </div>
  );
}
