"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * A polaroid — white card, photo inside, caption on the bottom margin.
 * `developing` is the in-progress state: the photo stays washed out and
 * breathes slowly; without it the image "develops" in over ~2s. Both
 * motions honour reduced-motion (static then).
 */
export function Polaroid({
  src,
  caption,
  developing = false,
  className = "",
}: {
  src: string;
  caption?: string;
  developing?: boolean;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={caption ?? ""}
      className="aspect-[3/4] w-full object-cover"
      style={
        developing
          ? { filter: "saturate(0.2) brightness(1.25) blur(2px)" }
          : undefined
      }
    />
  );
  return (
    <div className={`bg-white p-2 pb-8 shadow-md ${className}`}>
      {developing ? (
        reduceMotion ? (
          img
        ) : (
          <motion.div
            animate={{ opacity: [0.55, 1, 0.55] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          >
            {img}
          </motion.div>
        )
      ) : reduceMotion ? (
        img
      ) : (
        <motion.div
          initial={{ opacity: 0.5, filter: "blur(14px) saturate(0) brightness(1.5)" }}
          animate={{ opacity: 1, filter: "blur(0px) saturate(1) brightness(1)" }}
          transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {img}
        </motion.div>
      )}
      {caption ? (
        <p className="mt-3 px-1 text-center font-display text-base text-neutral-800">{caption}</p>
      ) : null}
    </div>
  );
}
