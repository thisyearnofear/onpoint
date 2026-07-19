"use client";

import { motion } from "framer-motion";
import { Crown, Medal, Sparkles, Trophy } from "lucide-react";
import type { CommunityLook } from "./types";

export function Leaderboard({ looks }: { looks: CommunityLook[] }) {
  const sorted = [...looks].sort((a, b) => b.likes - a.likes).slice(0, 3);
  if (sorted.length < 3) return null;

  const podiumColors = [
    { bg: "from-amber-400 to-yellow-500", border: "border-amber-400/40", text: "text-warning", medal: "🥇" },
    { bg: "from-slate-300 to-slate-400", border: "border-slate-400/40", text: "text-muted-foreground/70", medal: "🥈" },
    { bg: "from-amber-700 to-amber-800", border: "border-warning/40", text: "text-warning", medal: "🥉" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-gradient-to-br from-card/80 to-card/40 p-4"
    >
      <div className="flex items-center gap-2 mb-4">
        <Medal className="w-4 h-4 text-warning" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Leaderboard
        </span>
        <span className="text-[10px] text-muted-foreground/50">
          Top liked looks
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {sorted.map((look, i) => {
          const colors = podiumColors[i]!;
          const date = new Date(look.createdAt);
          const dateLabel = date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });

          return (
            <motion.div
              key={look.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`rounded-xl border ${colors.border} bg-gradient-to-b ${colors.bg}/10 p-3 text-center`}
            >
              <div className="text-lg mb-1">{colors.medal}</div>
              <div className={`w-8 h-8 mx-auto rounded-lg bg-gradient-to-br ${colors.bg} flex items-center justify-center text-white text-sm font-black shadow-sm mb-2`}>
                {look.persona ? look.persona[0]!.toUpperCase() : "?"}
              </div>
              <p className="text-[10px] font-semibold text-foreground leading-tight line-clamp-2 mb-1">
                {look.headline}
              </p>
              <div className="flex items-center justify-center gap-1">
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-warning">
                  <Sparkles className="w-2.5 h-2.5" />
                  {look.score}/10
                </span>
                <span className="text-[9px] text-muted-foreground/60">&middot;</span>
                <span className={`text-[9px] font-bold ${colors.text}`}>
                  {look.likes} ❤️
                </span>
              </div>
              <p className="text-[8px] text-muted-foreground/50 mt-1">{dateLabel}</p>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
