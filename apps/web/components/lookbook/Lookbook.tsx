"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface LookbookPage {
  key: string;
  /** Short ordinal label — announced to screen readers and shown in the counter. */
  label: string;
  node: React.ReactNode;
}

interface LookbookProps {
  pages: LookbookPage[];
  /** Max width of the book frame. */
  widthClassName?: string;
  className?: string;
}

const EASE = [0.16, 1, 0.3, 1] as const;
const DRAG_COMMIT_PX = 72;
const DRAG_MAX_PX = 220;
const FLICK_VELOCITY = 0.6; // px/ms

/**
 * The spread viewer — one book, many page types. Pages are supplied as
 * data (cover, spreads, back); the viewer owns the flip physics, keyboard,
 * touch, screen-reader announcements, and the reduced-motion cut mode.
 *
 * Interaction model (leafthrough): the page tracks the pointer while
 * dragging, and release commits or cancels on distance + flick velocity —
 * paper, not a carousel threshold.
 */
export function Lookbook({ pages, widthClassName = "max-w-md", className }: LookbookProps) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [hintDone, setHintDone] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const dragX = useMotionValue(0);
  const dragRotate = useTransform(dragX, (v) => v * 0.06);
  const dragStart = useRef<{ x: number; t: number } | null>(null);
  const lastMove = useRef<{ x: number; t: number } | null>(null);
  const total = pages.length;
  const current = pages[index];

  const flip = useCallback(
    (d: number) => {
      setHintDone(true);
      const next = Math.min(Math.max(index + d, 0), total - 1);
      if (next === index) return;
      setDir(d);
      const target = pages[next];
      setAnnouncement(target ? `Page ${next + 1} of ${total}: ${target.label}` : "");
      setIndex(next);
    },
    [index, total, pages],
  );

  useEffect(() => {
    setAnnouncement(pages[0] ? `Page 1 of ${total}: ${pages[0].label}` : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") flip(1);
      if (e.key === "ArrowLeft") flip(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flip]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (reduceMotion) return;
    dragStart.current = { x: e.clientX, t: performance.now() };
    lastMove.current = { x: e.clientX, t: performance.now() };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current || reduceMotion) return;
    const dx = e.clientX - dragStart.current.x;
    const clamped = Math.max(-DRAG_MAX_PX, Math.min(DRAG_MAX_PX, dx));
    dragX.set(clamped);
    lastMove.current = { x: e.clientX, t: performance.now() };
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const start = dragStart.current;
    const last = lastMove.current;
    dragStart.current = null;
    lastMove.current = null;

    let velocity = 0;
    if (last && last.t > start.t) {
      velocity = Math.abs(last.x - start.x) / Math.max(1, last.t - start.t);
    }
    // Direction of the flick, px/ms signed by travel direction.
    const flick = last && last.t > start.t ? (last.x - start.x) / Math.max(1, last.t - start.t) : 0;

    const commit =
      Math.abs(dx) > DRAG_COMMIT_PX || (velocity > FLICK_VELOCITY && Math.abs(flick) > FLICK_VELOCITY);
    const d = dx < 0 || flick < -FLICK_VELOCITY ? 1 : -1;

    if (commit) {
      // Page follows through in the drag direction, then the turn completes.
      animate(dragX, Math.sign(dx || flick) * window.innerWidth * 0.6, {
        duration: 0.28,
        ease: EASE,
      });
      flip(d);
    }
    animate(dragX, 0, { type: "spring", stiffness: 320, damping: 30 });
  };

  const onPointerCancel = () => {
    dragStart.current = null;
    lastMove.current = null;
    animate(dragX, 0, { type: "spring", stiffness: 320, damping: 30 });
  };

  if (!current) return null;

  const pageTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.6, ease: EASE };

  return (
    <div className={className}>
      {/* Screen-reader page announcements */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <div className={`mx-auto w-full ${widthClassName}`} style={{ perspective: "1600px" }}>
        <div
          role="region"
          aria-roledescription="flipbook"
          aria-label="Lookbook pages"
          className="relative aspect-[3/4] w-full touch-pan-y overflow-hidden rounded-sm border border-border shadow-lg shadow-black/20"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onTouchStart={(e) => {
            // Coarse-pointer swipe fallback (pointer events cover most, this is belt-and-braces).
            (e.currentTarget as HTMLElement).dataset.touchX = String(e.touches[0]?.clientX ?? "");
          }}
          onTouchEnd={(e) => {
            const startX = Number((e.currentTarget as HTMLElement).dataset.touchX);
            const endX = e.changedTouches[0]?.clientX ?? startX;
            if (Number.isFinite(startX) && Math.abs(endX - startX) > 40) {
              flip(endX < startX ? 1 : -1);
            }
            delete (e.currentTarget as HTMLElement).dataset.touchX;
          }}
        >
          <AnimatePresence mode="popLayout" custom={dir} initial={false}>
            <motion.div
              key={current.key}
              custom={dir}
              initial={reduceMotion ? false : { rotateY: dir > 0 ? 70 : -70, x: dir > 0 ? 60 : -60, opacity: 0.6 }}
              animate={
                index === 0 && !hintDone && !reduceMotion
                  ? { rotateY: [0, -14, 0], x: 0, opacity: 1 }
                  : { rotateY: 0, x: 0, opacity: 1 }
              }
              onAnimationComplete={() => {
                if (index === 0 && !hintDone) setHintDone(true);
              }}
              exit={reduceMotion ? { opacity: 0 } : { rotateY: dir > 0 ? -70 : 70, x: dir > 0 ? -60 : 60, opacity: 0 }}
              transition={pageTransition}
              style={{ transformOrigin: "left center", transformStyle: "preserve-3d" }}
              className="absolute inset-0"
            >
              {/* Drag-follow layer: the page tracks the pointer, releases with momentum. */}
              <motion.div style={{ x: dragX, rotate: dragRotate }} className="h-full w-full">
                <div className="h-full w-full">{current.node}</div>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          <button
            type="button"
            aria-label="Previous page"
            onClick={() => flip(-1)}
            disabled={index === 0}
            className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-border bg-background/80 p-2 text-foreground backdrop-blur transition-opacity hover:border-foreground disabled:opacity-20"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next page"
            onClick={() => flip(1)}
            disabled={index === total - 1}
            className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-border bg-background/80 p-2 text-foreground backdrop-blur transition-opacity hover:border-foreground disabled:opacity-20"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-4 text-center font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {current.label} · {index + 1} of {total}
          {reduceMotion ? "" : " — drag, swipe, tap the edges, or arrow keys"}
        </p>
      </div>
    </div>
  );
}
