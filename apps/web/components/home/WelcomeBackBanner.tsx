"use client";

import Link from "next/link";
import { Sparkles, ChevronRight } from "lucide-react";
import { useAnalysisHistory } from "../../lib/stores/analysis-history-store";
import { useScoreProgression } from "../../lib/hooks/useScoreProgression";

export function WelcomeBackBanner() {
  const sessions = useAnalysisHistory((state) => state.sessions);
  const latest = sessions[0];
  const { totalLooks, bestScore, trend, daysSinceLastLook } = useScoreProgression();

  if (!latest) return null;

  const now = Date.now();
  const created = new Date(latest.createdAt).getTime();
  const hoursAgo = Math.floor((now - created) / 3600000);
  const daysAgo = Math.floor(hoursAgo / 24);
  let timeAgo: string;
  if (hoursAgo < 1) timeAgo = "just now";
  else if (hoursAgo < 24) timeAgo = `${hoursAgo}h ago`;
  else if (daysAgo < 7) timeAgo = `${daysAgo}d ago`;
  else timeAgo = new Date(latest.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const isStale = daysSinceLastLook !== null && daysSinceLastLook >= 7;
  const trendLabel = trend === "improving" ? "Your scores are trending up" : trend === "declining" ? "Time to try a new stylist?" : null;

  return (
    <div className="mb-6 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 p-4">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">
            {isStale ? "It's been a while — your style skills are waiting" : "Welcome back!"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Last analysis {timeAgo} — <span className="font-semibold text-primary">{latest.score}/10</span>
            {latest.persona && <>, styled by <span className="capitalize font-medium">{latest.persona}</span></>}
            {totalLooks > 1 && <> · {totalLooks} looks{bestScore ? `, best: ${bestScore}/10` : ""}</>}
          </p>
          {trendLabel && (
            <p className="mt-0.5 text-[11px] font-medium text-primary">{trendLabel}</p>
          )}
        </div>
        <Link
          href="/lab?tab=my-looks"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 active:bg-primary/80 active:scale-[0.98] transition-[background-color,transform]"
        >
          View looks
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
