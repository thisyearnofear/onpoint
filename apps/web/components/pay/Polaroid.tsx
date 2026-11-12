"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

/**
 * A polaroid — white card, photo inside, caption on the bottom margin.
 * `developing` is the in-progress state: the photo stays washed out and
 * breathes slowly; `overlaySrc` (the garment image) cross-fades in and
 * out over it while a thin highlight sweeps down — the "trying it on"
 * loop. Without `developing` the image "develops" in over ~2s. All
 * motion honours reduced-motion (static then).
 */
export function Polaroid({
  src,
  caption,
  developing = false,
  overlaySrc,
  className = "",
}: {
  src: string;
  caption?: string;
  developing?: boolean;
  /** Garment image that fades over the washed-out photo while developing */
  overlaySrc?: string | null;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [overlayOk, setOverlayOk] = useState(true);
  const showOverlay = developing && overlaySrc && overlayOk;
  return (
    <div className={`bg-white p-2 pb-8 shadow-md ${className}`}>
      <div className="relative overflow-hidden">
        {developing ? (
          reduceMotion ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={caption ?? ""}
              className="aspect-[3/4] w-full object-cover"
              style={{ filter: "saturate(0.2) brightness(1.25) blur(2px)" }}
            />
          ) : (
            <motion.div
              animate={{ opacity: [0.55, 1, 0.55] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={caption ?? ""}
                className="aspect-[3/4] w-full object-cover"
                style={{ filter: "saturate(0.2) brightness(1.25) blur(2px)" }}
              />
            </motion.div>
          )
        ) : reduceMotion ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={caption ?? ""} className="aspect-[3/4] w-full object-cover" />
        ) : (
          <motion.div
            initial={{ opacity: 0.5, filter: "blur(14px) saturate(0) brightness(1.5)" }}
            animate={{ opacity: 1, filter: "blur(0px) saturate(1) brightness(1)" }}
            transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={caption ?? ""} className="aspect-[3/4] w-full object-cover" />
          </motion.div>
        )}

        {/* The garment fading in and out over the washed-out photo */}
        {showOverlay ? (
          reduceMotion ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={overlaySrc}
              alt=""
              onError={() => setOverlayOk(false)}
              className="absolute inset-0 h-full w-full object-contain opacity-30"
            />
          ) : (
            <motion.div
              className="absolute inset-0"
              animate={{ opacity: [0, 0.55, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={overlaySrc}
                alt=""
                onError={() => setOverlayOk(false)}
                className="h-full w-full object-contain"
              />
            </motion.div>
          )
        ) : null}

        {/* Thin highlight sweeping top→bottom while developing */}
        {developing && !reduceMotion ? (
          <motion.div
            className="absolute inset-x-0 h-0.5 bg-foreground/20"
            animate={{ top: ["0%", "100%"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
        ) : null}
      </div>
      {caption ? (
        <p className="mt-3 px-1 text-center font-display text-base text-neutral-800">{caption}</p>
      ) : null}
    </div>
  );
}
