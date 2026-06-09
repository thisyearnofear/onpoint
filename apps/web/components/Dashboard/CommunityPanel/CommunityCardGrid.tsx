"use client";

import { motion } from "framer-motion";
import { Heart, Sparkles, Flag } from "lucide-react";
import type { CommunityLook } from "./types";
import { ACCENT_COLORS, DEFAULT_GRAD } from "./types";
import { BookmarkButton } from "./BookmarkButton";
import { highlightText } from "./SearchHighlight";

export function CommunityCardGrid({
  look,
  likedLooks,
  onLike,
  onBookmark,
  onReport,
  bookmarkedIds,
  reportedIds,
  searchQuery,
  index,
}: {
  look: CommunityLook;
  likedLooks: Set<string>;
  onLike: (id: string) => void;
  onBookmark?: (id: string) => void;
  onReport?: (id: string) => void;
  bookmarkedIds?: Set<string>;
  reportedIds?: Set<string>;
  searchQuery?: string;
  index: number;
}) {
  const isLiked = likedLooks.has(look.id);
  const isBookmarked = bookmarkedIds?.has(look.id) ?? false;
  const isReported = reportedIds?.has(look.id) ?? false;

  const grad =
    look.persona && ACCENT_COLORS[look.persona.toLowerCase()]
      ? ACCENT_COLORS[look.persona.toLowerCase()]!
      : DEFAULT_GRAD;

  const date = new Date(look.createdAt);
  const now = new Date();
  const hoursAgo = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60),
  );
  const timeAgo =
    hoursAgo < 1 ? "just now" : hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo / 24)}d ago`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.04 }}
      className={`rounded-xl border transition-all overflow-hidden ${
        isBookmarked
          ? "border-sky-500/20 bg-card/60"
          : isReported
            ? "border-rose-500/20 bg-card/60"
            : "border-border bg-card/50 hover:bg-card/70 hover:shadow-sm"
      }`}
    >
      <div className="p-3">
        {/* Top row: avatar + actions */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center text-white text-sm font-bold shadow-sm`}
            >
              {look.persona ? look.persona[0]!.toUpperCase() : "?"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground leading-tight line-clamp-1">
                {searchQuery ? highlightText(look.headline, searchQuery) : look.headline}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-500">
                  <Sparkles className="w-2 h-2" />
                  {look.score}/10
                </span>
                <span className="text-[9px] text-muted-foreground/60">{timeAgo}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onLike(look.id); }}
              className={`flex items-center gap-0.5 px-1 py-0.5 rounded-md transition-all ${
                isLiked ? "text-rose-500" : "text-muted-foreground/40 hover:text-rose-400"
              }`}
            >
              <Heart className={`w-3 h-3 ${isLiked ? "fill-rose-500" : ""}`} />
              <span className="text-[8px] font-medium tabular-nums">{look.likes}</span>
            </button>
            {onBookmark && (
              <BookmarkButton isBookmarked={isBookmarked} onToggle={() => onBookmark(look.id)} size="sm" />
            )}
          </div>
        </div>

        {/* Topic pills (max 2) */}
        {look.topics.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {look.topics.slice(0, 2).map((topic, i) => (
              <span key={i} className="rounded-full bg-muted/50 px-1.5 py-0.5 text-[8px] text-muted-foreground/70">
                {topic}
              </span>
            ))}
          </div>
        )}

        {/* Report button (subtle, bottom-right) */}
        <div className="flex items-center justify-between">
          {look.persona && (
            <span className="text-[8px] capitalize text-muted-foreground/50">via {look.persona}</span>
          )}
          {onReport && (
            <button
              onClick={(e) => { e.stopPropagation(); onReport(look.id); }}
              className={`p-0.5 rounded transition-all ${
                isReported
                  ? "text-rose-400/70"
                  : "text-muted-foreground/20 hover:text-rose-400/60"
              }`}
              title={isReported ? "Reported" : "Report this look"}
            >
              <Flag className={`w-2.5 h-2.5 ${isReported ? "fill-rose-400/70" : ""}`} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
