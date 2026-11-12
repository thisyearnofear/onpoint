"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import type { TraceStep } from "@/lib/pay/trace";

/** Live m:ss counter for a pending row — the honest wait, no staged ticks. */
function PendingElapsed() {
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef(performance.now());
  useEffect(() => {
    const t = setInterval(() => {
      setSeconds(Math.floor((performance.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, []);
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");
  return <span className="font-mono text-xs tabular-nums text-muted-foreground">{mm}:{ss}</span>;
}

/**
 * The agent's work as a first-person trace. Rows land as their backing
 * facts land — the done batch staggers in 340ms apart, and a row already
 * shown never re-animates (stable keys, delays assigned once per step id).
 */
export function AgentTrace({
  steps,
  verdict,
  title = "What I did",
}: {
  steps: TraceStep[];
  verdict: string | null;
  title?: string;
}) {
  const reduceMotion = useReducedMotion();
  // Delay assigned the first time a step id is seen, so rows already on
  // screen stay put when later steps join the list.
  const delays = useRef<Map<string, number>>(new Map());
  // Rows joining in the same render stagger 340ms apart; rows already on
  // screen keep the delay they mounted with and never re-animate.
  let nextDelay = 0;
  for (const s of steps) {
    if (!delays.current.has(s.id)) {
      delays.current.set(s.id, reduceMotion ? 0 : nextDelay * 0.34);
      nextDelay += 1;
    }
  }

  const allDone = steps.length > 0 && steps.every((s) => s.state === "done");
  // The verdict lands after the last staggered row finishes animating.
  const verdictDelay = reduceMotion ? 0 : (nextDelay > 0 ? (nextDelay - 1) * 0.34 : 0) + 0.32 + 0.4;

  if (steps.length === 0) return null;

  return (
    <div className="w-full">
      <p className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
      <ol aria-live="polite" className="divide-y divide-dotted divide-border">
        {steps.map((s) => (
          <motion.li
            key={s.id}
            initial={reduceMotion ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1], delay: delays.current.get(s.id) ?? 0 }}
            className="flex items-start gap-3 py-2.5"
          >
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
              {s.state === "done" ? (
                <Check className="h-4 w-4 text-foreground" strokeWidth={2.5} />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-xs uppercase tracking-wider">{s.label}</span>
                {s.state === "pending" ? <PendingElapsed /> : null}
              </span>
              {s.detail ? (
                s.href ? (
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block break-words text-sm text-primary underline-offset-2 hover:underline"
                  >
                    {s.detail}
                  </a>
                ) : (
                  <span className="mt-0.5 block break-words text-sm text-muted-foreground">{s.detail}</span>
                )
              ) : null}
            </span>
          </motion.li>
        ))}
      </ol>
      {allDone && verdict ? (
        <motion.p
          initial={reduceMotion ? false : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1], delay: verdictDelay }}
          className="mt-4 border-l-2 border-foreground pl-3 font-display text-lg leading-snug"
        >
          {verdict}
        </motion.p>
      ) : null}
    </div>
  );
}
