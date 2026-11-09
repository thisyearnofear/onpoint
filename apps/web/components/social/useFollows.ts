"use client";

import { useCallback, useEffect, useState } from "react";
import { celebrateFirst } from "./firsts";

const KEY = "onpoint:follows";

export interface FollowTarget {
  kind: "curator" | "agent";
  id: string;
  label?: string;
}

function read(): FollowTarget[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as FollowTarget[];
  } catch {
    /* ignore */
  }
  return [];
}

/** Follow curators/agents. Local-first (no wallet needed); fires funnel events. */
export function useFollows() {
  const [follows, setFollows] = useState<FollowTarget[]>([]);

  useEffect(() => {
    setFollows(read());
  }, []);

  const isFollowing = useCallback(
    (kind: FollowTarget["kind"], id: string) =>
      follows.some((f) => f.kind === kind && f.id.toLowerCase() === id.toLowerCase()),
    [follows],
  );

  const toggle = useCallback((target: FollowTarget) => {
    setFollows((prev) => {
      const exists = prev.some(
        (f) => f.kind === target.kind && f.id.toLowerCase() === target.id.toLowerCase(),
      );
      const next = exists
        ? prev.filter((f) => !(f.kind === target.kind && f.id.toLowerCase() === target.id.toLowerCase()))
        : [...prev, target];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      if (!exists) celebrateFirst("follow");
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
      } catch {
        /* noop */
      }
      void fetch("/api/loop/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: exists ? "unfollow" : "follow",
          meta: { kind: target.kind, id: target.id },
        }),
      }).catch(() => undefined);
      return next;
    });
  }, []);

  return { follows, isFollowing, toggle };
}
