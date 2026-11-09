"use client";

import { celebrate } from "../state/celebrate";

/**
 * First-time delight: one confetti + badge per action, no points system.
 * Single owner of "firsts" — components call celebrateFirst() once and get
 * the toast event plus the budgeted confetti together. Do not call the
 * state/celebrate budget or dispatch onpoint:first separately.
 */

const ACTIONS = ["tryon", "share", "vote", "remix", "save", "follow"] as const;
export type FirstAction = (typeof ACTIONS)[number];

const KEY = "onpoint:firsts";

function read(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Record<string, number>;
  } catch {
    /* ignore */
  }
  return {};
}

/** True if this is the first time — records it. */
export function markFirst(action: FirstAction): boolean {
  try {
    const all = read();
    if (all[action]) return false;
    all[action] = Date.now();
    localStorage.setItem(KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

/**
 * Mark + celebrate a first-time action. Returns true only the very first
 * time (per action per device). Fires the onpoint:first toast event and the
 * budgeted confetti together so the two systems can't drift apart.
 */
export function celebrateFirst(action: FirstAction): boolean {
  if (!markFirst(action)) return false;
  try {
    window.dispatchEvent(new CustomEvent("onpoint:first", { detail: action }));
  } catch {
    /* ignore */
  }
  celebrate(`first:${action}`);
  return true;
}

export function hasFirst(action: FirstAction): boolean {
  try {
    return Boolean(read()[action]);
  } catch {
    return false;
  }
}

const MESSAGES: Record<FirstAction, string> = {
  tryon: "First try-on 🔥",
  share: "First share — your link earns 2.5%",
  vote: "First vote counted",
  remix: "First remix — make it yours",
  save: "Saved to your list",
  follow: "Following — fresh drops incoming",
};

export function firstMessage(action: FirstAction): string {
  return MESSAGES[action];
}
