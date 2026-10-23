"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

export interface RunwayScores {
  theme: number;
  cohesion: number;
  styling: number;
}

const LABELS: Array<{ key: keyof RunwayScores; label: string }> = [
  { key: "theme", label: "THEME" },
  { key: "cohesion", label: "COHESION" },
  { key: "styling", label: "STYLING" },
];

function Paddle({
  label,
  value,
  index,
  animated,
}: {
  label: string;
  value: number;
  index: number;
  animated: boolean;
}) {
  const body = (
    <div
      role="img"
      aria-label={`${label.charAt(0) + label.slice(1).toLowerCase()}: ${value} out of 10`}
      className="flex w-full flex-col items-center rounded-2xl border border-zinc-700/80 bg-zinc-900/90 px-2 py-4 shadow-lg shadow-black/40"
    >
      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-400">
        {label}
      </span>
      <span className="mt-2 text-5xl font-black tabular-nums text-zinc-50">
        {value}
      </span>
    </div>
  );
  return (
    <div className="flex w-28 flex-col items-center sm:w-32">
      {animated ? (
        <motion.div
          className="w-full"
          style={{ transformPerspective: 700 }}
          initial={{ rotateX: 90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 160,
            damping: 16,
            delay: index * 0.35,
          }}
        >
          {body}
        </motion.div>
      ) : (
        body
      )}
      <div aria-hidden className="h-6 w-1 rounded-b bg-zinc-700" />
    </div>
  );
}

export function ScorePaddles({
  scores,
  total,
  judgeName,
  animated = false,
  size = "md",
}: {
  scores: RunwayScores;
  total: number;
  judgeName?: string;
  animated?: boolean;
  size?: "sm" | "md";
}) {
  const reduce = useReducedMotion();
  const flip = animated && !reduce;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-start justify-center gap-3 sm:gap-4">
        {LABELS.map((l, i) => (
          <Paddle key={l.key} label={l.label} value={scores[l.key]} index={i} animated={flip} />
        ))}
      </div>
      <p className="text-center" aria-live="polite" aria-label={`Total score ${total.toFixed(1)} out of 10`}>
        <span className={`font-black tabular-nums text-zinc-50 ${size === "sm" ? "text-2xl" : "text-4xl"}`}>
          {total.toFixed(1)}
        </span>
        <span className="text-xl font-bold text-zinc-500">/10</span>
        {judgeName && (
          <span className="block text-sm text-zinc-400">judged by {judgeName}</span>
        )}
      </p>
    </div>
  );
}
