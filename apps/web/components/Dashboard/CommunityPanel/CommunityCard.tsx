"use client";

import { motion } from "framer-motion";
import { Heart, Sparkles, Flag } from "lucide-react";
import type { CommunityLook } from "./types";
import { ACCENT_COLORS, DEFAULT_GRAD } from "./types";
import { EmojiBar } from "./EmojiBar";
import { BookmarkButton } from "./BookmarkButton";
import { highlightText, matchesSearch } from "./SearchHighlight";

export function CommunityCard({
  look,
  likedLooks,
  onLike,
  onReact,
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
  onReact: (id: string, emoji: string) => void;
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
  const showHighlight = searchQuery && matchesSearch(look, searchQuery);

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
    hoursAgo < 1
      ? "just now"
      : hoursAgo < 24
        ? `${hoursAgo}h ago`
        : `${Math.floor(hoursAgo / 24)}d ago`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`rounded-2xl border transition-colors overflow-hidden ${
        isBookmarked
          ? "border-sky-500/20 bg-card/60"
          : "border-border bg-card/60 hover:bg-card/80"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Persona gradient circle */}
          <div
            className={`w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white text-lg font-black shadow-sm`}
          >
            {look.persona ? look.persona[0]!.toUpperCase() : "?"}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
                  {showHighlight
                    ? highlightText(look.headline, searchQuery!)
                    : look.headline}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-500">
                    <Sparkles className="w-3 h-3" />
                    {look.score}/10
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {timeAgo}
                  </span>
                  {look.persona && (
                    <span className="text-[10px] capitalize text-muted-foreground/70">
                      via {look.persona}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Takeaways */}
            {look.takeaways.length > 0 && (
              <div className="mt-2 space-y-1">
                {look.takeaways.slice(0, 2).map((tip, i) => (
                  <p
                    key={i}
                    className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-1"
                  >
                    {showHighlight
                      ? highlightText(tip, searchQuery!)
                      : tip}
                  </p>
                ))}
                {look.takeaways.length > 2 && (
                  <p className="text-[10px] text-muted-foreground/50">
                    +{look.takeaways.length - 2} more
                  </p>
                )}
              </div>
            )}

            {/* Topics */}
            {look.topics.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {look.topics.slice(0, 3).map((topic, i) => (
                  <span
                    key={i}
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      showHighlight && topic.toLowerCase().includes(searchQuery!.toLowerCase())
                        ? "bg-amber-400/30 text-foreground font-medium"
                        : "bg-muted/70 text-muted-foreground/80"
                    }`}
                  >
                    {showHighlight
                      ? highlightText(topic, searchQuery!)
                      : topic}
                  </span>
                ))}
              </div>
            )}

            {/* Emoji reactions */}
            <div className="mt-2.5 pt-2.5 border-t border-border/40">
              <EmojiBar lookId={look.id} reactions={look.reactions} onReact={onReact} />
            </div>
          </div>

          {/* Action buttons column */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            {/* Like button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLike(look.id);
              }}
              className={`flex flex-col items-center gap-0.5 px-1 py-1 rounded-lg transition-all ${
                isLiked
                  ? "text-rose-500"
                  : "text-muted-foreground/50 hover:text-rose-400"
              }`}
            >
              <Heart
                className={`w-4 h-4 transition-all ${
                  isLiked ? "fill-rose-500 scale-110" : ""
                }`}
              />
              <span className="text-[10px] font-medium tabular-nums">
                {look.likes}
              </span>
            </button>

            {/* Bookmark button */}
            {onBookmark && (
              <BookmarkButton
                isBookmarked={isBookmarked}
                onToggle={() => onBookmark(look.id)}
                size="sm"
              />
            )}

            {/* Report button */}
            {onReport && (
              <button
                onClick={(e) => { e.stopPropagation(); onReport(look.id); }}
                className={`p-1 rounded-lg transition-all ${
                  isReported
                    ? "text-rose-400/70"
                    : "text-muted-foreground/20 hover:text-rose-400/60"
                }`}
                title={isReported ? "Reported" : "Report this look"}
              >
                <Flag className={`w-3 h-3 ${isReported ? "fill-rose-400/70" : ""}`} />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
