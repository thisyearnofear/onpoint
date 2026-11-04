import React, { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/** Verdict text typed in character-by-character; instant under reduced motion. */
export function TypedText({ text, onDone }: { text: string; onDone?: () => void }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduce) { setN(text.length); return; }
    setN(0);
    const id = window.setInterval(() => setN((v) => Math.min(v + 1, text.length)), 14);
    return () => window.clearInterval(id);
  }, [text, reduce]);
  const done = n >= text.length;
  useEffect(() => {
    if (done) onDone?.();
  }, [done, onDone]);
  return <>{text.slice(0, n)}{!done && <span className="animate-pulse">▌</span>}</>;
}
