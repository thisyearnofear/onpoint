"use client";

import { motion } from "framer-motion";
import { Hash } from "lucide-react";
import type { CommunityLook } from "./types";

export function TrendingTopics({
  looks,
  activeTopic,
  onTopicToggle,
}: {
  looks: CommunityLook[];
  activeTopic: string | null;
  onTopicToggle: (topic: string | null) => void;
}) {
  const topicCounts: Record<string, number> = {};
  for (const look of looks) {
    for (const topic of look.topics) {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    }
  }

  const sorted = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  if (sorted.length === 0) return null;

  const maxCount = sorted[0]![1];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card/40 p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Hash className="w-3.5 h-3.5 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Trending Topics
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {activeTopic && (
          <button
            onClick={() => onTopicToggle(null)}
            className="rounded-full bg-primary/20 text-primary ring-1 ring-primary/30 px-2 py-0.5 text-[10px] font-medium"
          >
            Clear filter
          </button>
        )}
        {sorted.map(([topic, count]) => {
          const weight = count / maxCount;
          const size = weight >= 0.7 ? "text-xs" : weight >= 0.4 ? "text-[11px]" : "text-[10px]";
          const opacity = 0.5 + weight * 0.5;

          return (
            <button
              key={topic}
              onClick={() => onTopicToggle(activeTopic === topic ? null : topic)}
              className={`rounded-full border px-2 py-0.5 font-medium transition-all hover:scale-105 ${size} ${
                activeTopic === topic
                  ? "bg-primary/20 text-primary border-primary/30 ring-1 ring-primary/30"
                  : "bg-muted/50 text-muted-foreground/80 border-border/50 hover:text-foreground hover:border-border"
              }`}
              style={{ opacity }}
            >
              {topic}
              <span className="ml-1 text-[9px] text-muted-foreground/50 font-normal">
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
