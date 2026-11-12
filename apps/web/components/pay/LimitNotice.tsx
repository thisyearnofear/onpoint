"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { formatWait, type LimitKind } from "../../lib/pay/allowance";

/**
 * The rate limit as a designed wait, not an error. The breather variant
 * counts down the minute window with a progress fill and picks the flow
 * back up itself once the clock runs out (one automatic retry — a second
 * 429 swaps the auto-retry for a manual button so it never loops). The
 * daily variant is terminal until the window resets, so it offers real
 * next actions instead of a countdown.
 */
export function LimitNotice({
  kind,
  waitSec,
  safeApproval,
  autoRetry,
  onExpired,
  onRetry,
  children,
}: {
  kind: LimitKind;
  /** Total wait in seconds (breather drives its bar and countdown from it). */
  waitSec: number;
  /** A PayPal approval is waiting but uncaptured — say it's safe. */
  safeApproval: boolean;
  /** Fire onExpired once at zero; otherwise show a manual retry button. */
  autoRetry: boolean;
  onExpired: () => void;
  onRetry: () => void;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const [remain, setRemain] = useState(() => Math.max(0, Math.ceil(waitSec)));
  const fired = useRef(false);
  const expiredRef = useRef(onExpired);
  expiredRef.current = onExpired;

  useEffect(() => {
    if (kind !== "breather") return;
    const end = Date.now() + waitSec * 1000;
    setRemain(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    const t = setInterval(() => {
      const r = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setRemain(r);
      if (r <= 0 && !fired.current) {
        fired.current = true;
        if (autoRetry) expiredRef.current();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [kind, waitSec, autoRetry]);

  const progress = Math.min(100, Math.max(0, (1 - remain / Math.max(1, waitSec)) * 100));

  // Bring the notice into view once, when it appears — never on later ticks.
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    boxRef.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, []);

  return (
    <div
      ref={boxRef}
      className="rounded-xl border border-border bg-card px-5 py-4"
    >
      {kind === "breather" ? (
        <>
          <p className="font-display text-lg">
            Give me {formatWait(remain)} — I&rsquo;m pacing myself.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            I can make five requests a minute for each visitor, and I&rsquo;ve used them.
            I&rsquo;ll pick this up myself when the clock runs out.
          </p>
          {safeApproval ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Your PayPal approval is safe — nothing is captured until I run the render.
            </p>
          ) : null}
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
            {reduce ? (
              <div className="h-full bg-foreground/60" style={{ width: `${progress}%` }} />
            ) : (
              <motion.div
                className="h-full bg-foreground/60"
                initial={{ width: `${progress}%` }}
                animate={{ width: "100%" }}
                transition={{ duration: Math.max(0.5, remain), ease: "linear" }}
              />
            )}
          </div>
          {!autoRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 min-h-11 text-sm font-semibold text-primary underline-offset-2 hover:underline"
            >
              Try again
            </button>
          ) : null}
        </>
      ) : (
        <>
          <p className="font-display text-xl">That&rsquo;s today&rsquo;s fitting room for this network.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            While OnPoint is in preview, each network gets twenty requests a day — about ten looks.
            It opens again in {formatWait(waitSec)}.
          </p>
          {safeApproval ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Your PayPal approval is safe — nothing is captured until I run the render.
            </p>
          ) : null}
          {children}
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 min-h-11 text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            Check again
          </button>
        </>
      )}
    </div>
  );
}
