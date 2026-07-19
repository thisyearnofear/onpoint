"use client";

import { motion } from "framer-motion";
import { Crown, Heart, Sparkles, Trophy } from "lucide-react";
import type { CommunityLook } from "./types";
import { EmojiBar } from "./EmojiBar";
import { BookmarkButton } from "./BookmarkButton";

export function LookOfTheWeekCard({
  look,
  onLike,
  onReact,
  onBookmark,
  likedLooks,
  bookmarkedIds,
}: {
  look: CommunityLook;
  onLike: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
  onBookmark?: (id: string) => void;
  likedLooks: Set<string>;
  bookmarkedIds?: Set<string>;
}) {
  const isLiked = likedLooks.has(look.id);
  const isBookmarked = bookmarkedIds?.has(look.id) ?? false;

  const date = new Date(look.createdAt);
  const dateLabel = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="relative overflow-hidden rounded-2xl border-2 border-warning/30 bg-gradient-to-br from-amber-500/10 via-card to-amber-500/5 shadow-lg shadow-amber-500/10"
    >
      {/* Decorative glow */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-warning/20 blur-[60px] rounded-full" />
      <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-amber-400/10 blur-[40px] rounded-full" />

      <div className="relative p-5">
        {/* Badge row */}
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1 text-white shadow-md">
            <Crown className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Look of the week
            </span>
          </div>
          <span className="text-[10px] text-warning/70 dark:text-amber-400/70 font-medium">
            {dateLabel}
          </span>
        </div>

        {/* Content */}
        <div className="flex items-start gap-4">
          {/* Winner avatar — larger with trophy */}
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-2xl font-black shadow-md shadow-amber-500/30">
              {look.persona ? look.persona[0]!.toUpperCase() : "?"}
            </div>
            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-warning flex items-center justify-center shadow-sm">
              <Trophy className="w-3 h-3 text-white" />
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-foreground leading-tight">
              {look.headline}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-0.5 text-sm font-bold text-warning">
                <Sparkles className="w-3.5 h-3.5" />
                {look.score}/10
              </span>
              <span className="text-xs text-muted-foreground">
                &middot; {look.likes} like{look.likes !== 1 ? "s" : ""} &middot;
              </span>
              {look.persona && (
                <span className="text-xs capitalize text-muted-foreground/70">
                  styled by {look.persona}
                </span>
              )}
            </div>

            {/* Takeaways */}
            {look.takeaways.length > 0 && (
              <div className="mt-2.5 space-y-1">
                {look.takeaways.slice(0, 2).map((tip, i) => (
                  <p
                    key={i}
                    className="text-sm text-muted-foreground/80 leading-relaxed"
                  >
                    {tip}
                  </p>
                ))}
                {look.takeaways.length > 2 && (
                  <p className="text-xs text-muted-foreground/50">
                    +{look.takeaways.length - 2} more insights
                  </p>
                )}
              </div>
            )}

            {/* Topics */}
            {look.topics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {look.topics.slice(0, 4).map((topic, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-warning/10 border border-warning/20 px-2.5 py-0.5 text-[11px] font-medium text-warning dark:text-amber-400"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            )}

            {/* Emoji reactions */}
            <div className="mt-3 pt-3 border-t border-warning/20">
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
              className={`flex flex-col items-center gap-0.5 shrink-0 px-1.5 py-1.5 rounded-xl transition-all ${
                isLiked
                  ? "text-rose-500 bg-rose-500/10"
                  : "text-muted-foreground/50 hover:text-rose-400 hover:bg-rose-500/5"
              }`}
            >
              <Heart
                className={`w-5 h-5 transition-all ${
                  isLiked ? "fill-rose-500 scale-110" : ""
                }`}
              />
              <span className="text-xs font-bold tabular-nums">{look.likes}</span>
            </button>

            {/* Bookmark button */}
            {onBookmark && (
              <BookmarkButton
                isBookmarked={isBookmarked}
                onToggle={() => onBookmark(look.id)}
                size="md"
              />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
