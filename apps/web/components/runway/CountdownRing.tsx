"use client";

import React, { useEffect, useRef, useState } from "react";
import { formatCountdown } from "../../lib/utils/runway";

const TOTAL_MS = 180_000;
const ANNOUNCE_AT = [120, 60, 30, 0]; // seconds left — aria-live polite

/**
 * 3-minute ring counting down from the server deadline. Turns accent at
 * ≤30s; after 0 shows "LATE — send it anyway" (never blocks).
 */
export function CountdownRing({ deadline }: { deadline: number }) {
  const [msLeft, setMsLeft] = useState(() => Math.max(0, deadline - Date.now()));
  const [announcement, setAnnouncement] = useState("");
  const announced = useRef(new Set<number>());

  useEffect(() => {
    const tick = () => {
      const left = deadline - Date.now();
      setMsLeft(Math.max(0, left));
      const sec = Math.ceil(left / 1000);
      for (const a of ANNOUNCE_AT) {
        if (sec <= a && !announced.current.has(a)) {
          announced.current.add(a);
          setAnnouncement(a === 0 ? "Time is up — you can still send it" : `${formatCountdown(a * 1000)} left`);
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [deadline]);

  const late = msLeft <= 0;
  const urgent = !late && msLeft <= 30_000;
  const frac = late ? 0 : msLeft / TOTAL_MS;
  const R = 34;
  const C = 2 * Math.PI * R;

  return (
    <div className="flex flex-col items-center gap-1" role="timer" aria-label="time left">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
          <circle cx="40" cy="40" r={R} fill="none" stroke="#27272a" strokeWidth="6" />
          <circle
            cx="40" cy="40" r={R} fill="none"
            stroke={urgent || late ? "hsl(var(--accent))" : "hsl(var(--primary))"}
            strokeWidth="6" strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - frac)}
            style={{ transition: "stroke-dashoffset 250ms linear, stroke 300ms" }}
          />
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center text-sm font-black tabular-nums ${
            late || urgent ? "text-[hsl(var(--accent))]" : "text-zinc-50"
          }`}
        >
          {late ? "LATE" : formatCountdown(msLeft)}
        </span>
      </div>
      {late && <p className="text-xs font-bold text-[hsl(var(--accent))]">LATE — send it anyway</p>}
      <span aria-live="polite" className="sr-only">{announcement}</span>
    </div>
  );
}
