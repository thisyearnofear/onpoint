"use client";

import React from "react";
import { REACTION_EMOJIS } from "./types";

// ── localStorage helpers ──

export function getReactedEmojis(lookId: string): Set<string> {
  try {
    const stored = localStorage.getItem(`onpoint-community-reacts:${lookId}`);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

export function setReactedEmoji(lookId: string, emoji: string) {
  try {
    const reacted = getReactedEmojis(lookId);
    reacted.add(emoji);
    localStorage.setItem(
      `onpoint-community-reacts:${lookId}`,
      JSON.stringify([...reacted]),
    );
  } catch {
    // ignore
  }
}

// ── EmojiBar Component ──

export function EmojiBar({
  lookId,
  reactions,
  onReact,
}: {
  lookId: string;
  reactions: Record<string, number>;
  onReact: (lookId: string, emoji: string) => void;
}) {
  const [reacted, setReacted] = React.useState<Set<string>>(() =>
    getReactedEmojis(lookId),
  );

  const handleReact = (emoji: string) => {
    if (reacted.has(emoji)) return;
    setReacted((prev) => new Set(prev).add(emoji));
    setReactedEmoji(lookId, emoji);
    onReact(lookId, emoji);
  };

  return (
    <div className="flex items-center gap-1">
      {REACTION_EMOJIS.map((emoji) => {
        const count = reactions[emoji] || 0;
        const isReacted = reacted.has(emoji);
        return (
          <button
            key={emoji}
            onClick={(e) => {
              e.stopPropagation();
              handleReact(emoji);
            }}
            className={`flex items-center gap-0.5 rounded-lg px-1.5 py-0.5 text-xs transition-all ${
              isReacted
                ? "bg-primary/10 ring-1 ring-primary/30 scale-105"
                : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <span className="text-sm leading-none">{emoji}</span>
            {count > 0 && (
              <span className="text-[10px] font-medium tabular-nums">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
