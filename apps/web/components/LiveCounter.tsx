"use client";

import React, { useEffect, useState, useRef } from "react";
import { Users } from "lucide-react";

const HEARTBEAT_INTERVAL = 30_000; // 30s
const POLL_INTERVAL = 20_000; // 20s

/**
 * LiveCounter — "X people trying on now" social proof badge.
 *
 * - Generates a random session ID on mount.
 * - Sends heartbeats every 30 s to keep the session alive.
 * - Polls the server every 20 s for the active count.
 * - Animates count changes with a subtle fade.
 * - Renders nothing until the first successful poll (avoids flash).
 * - Renders nothing if count is 0.
 */
export function LiveCounter() {
  const [count, setCount] = useState<number | null>(null);
  const sessionId = useRef<string>(
    typeof crypto !== "undefined"
      ? crypto.randomUUID()
      : `session-${Math.random().toString(36).slice(2, 10)}`,
  );

  /* ---- heartbeat ---- */
  useEffect(() => {
    const send = () => {
      fetch("/api/live/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current }),
      }).catch(() => {
        /* silently fail — non-critical */
      });
    };

    send(); // immediate first beat
    const id = setInterval(send, HEARTBEAT_INTERVAL);
    return () => clearInterval(id);
  }, []);

  /* ---- poll count ---- */
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/live/count");
        if (!res.ok) return;
        const data = await res.json();
        setCount(typeof data.count === "number" ? data.count : 0);
      } catch {
        /* silently fail */
      }
    };

    poll(); // immediate first poll
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  if (count === null || count === 0) return null;

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-fade-in">
      <Users className="w-3 h-3" />
      <span>
        <span className="font-bold tabular-nums">{count}</span>{" "}
        {count === 1 ? "person" : "people"} trying on now
      </span>
    </span>
  );
}
