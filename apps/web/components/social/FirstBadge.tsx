"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { firstMessage, type FirstAction } from "./firsts";

/**
 * Tiny celebratory toast for first-time actions. Render once near the
 * social surface; listens for `onpoint:first` events fired by siblings.
 */
export function FirstBadge() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const onFirst = (e: Event) => {
      const action = (e as CustomEvent<FirstAction>).detail;
      if (!action) return;
      setMsg(firstMessage(action));
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([12, 40, 12]);
      } catch {
        /* noop */
      }
      setTimeout(() => setMsg(null), 2600);
    };
    window.addEventListener("onpoint:first", onFirst as EventListener);
    return () => window.removeEventListener("onpoint:first", onFirst as EventListener);
  }, []);

  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          className="pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full border border-primary/30 bg-background/95 px-4 py-2 text-xs font-bold shadow-xl backdrop-blur"
          role="status"
        >
          🎉 {msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// NOTE: fire firsts via celebrateFirst() in ./firsts (mark + toast event +
// budgeted confetti together). This component only listens and renders.
