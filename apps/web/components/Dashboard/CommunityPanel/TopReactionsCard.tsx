"use client";

import { motion } from "framer-motion";
import { BarChart3, Share2 } from "lucide-react";
import type { CommunityLook } from "./types";

export function TopReactionsCard({ looks }: { looks: CommunityLook[] }) {
  if (looks.length === 0) return null;

  const totalLikesGiven = looks.reduce((sum, l) => sum + l.likes, 0);
  const topScore = Math.max(...looks.map((l) => l.score));

  const emojiCounts: Record<string, number> = {};
  for (const look of looks) {
    for (const [emoji, count] of Object.entries(look.reactions)) {
      emojiCounts[emoji] = (emojiCounts[emoji] || 0) + count;
    }
  }
  const topEmoji = Object.entries(emojiCounts).sort((a, b) => b[1] - a[1])[0];

  const shareSummary = async () => {
    const summary = [
      `My OnPoint Community Reactions`,
      ``,
      `Reacted to ${looks.length} look${looks.length !== 1 ? "s" : ""}`,
      `💝 Total likes given: ${totalLikesGiven}`,
      topEmoji ? `🏆 Top reaction: ${topEmoji[0]} (used ${topEmoji[1]} times)` : null,
      `⭐ Highest scored look: ${topScore}/10`,
      ``,
      `Shared from OnPoint — AI-powered personal styling`,
    ]
      .filter(Boolean)
      .join("\n");

    if (navigator.share) {
      try {
        await navigator.share({ text: summary });
      } catch {
        // User cancelled
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(summary);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/5 via-card to-pink-500/5 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
              My Reactions Recap
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-2xl font-black text-foreground">{looks.length}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                looks reacted
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-foreground">
                {totalLikesGiven}
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                likes given
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-foreground">
                {topScore}/10
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                top score
              </p>
            </div>
          </div>
          {topEmoji && (
            <div className="flex items-center gap-2 mt-2.5 text-xs text-muted-foreground/80">
              <span className="text-sm">{topEmoji[0]}</span>
              <span>
                Used <strong className="text-foreground">{topEmoji[1]} times</strong>
                — your most used reaction
              </span>
            </div>
          )}
        </div>
        <button
          onClick={shareSummary}
          className="flex items-center gap-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-500 transition-all shrink-0"
        >
          <Share2 className="w-3.5 h-3.5" />
          Share
        </button>
      </div>
    </motion.div>
  );
}
