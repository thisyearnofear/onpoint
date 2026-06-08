"use client";

import { Bookmark } from "lucide-react";

export function BookmarkButton({
  isBookmarked,
  onToggle,
  size = "sm",
}: {
  isBookmarked: boolean;
  onToggle: () => void;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "md" ? "w-5 h-5" : "w-4 h-4";
  const paddingClass = size === "md" ? "px-1.5 py-1.5" : "px-1 py-1";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`flex flex-col items-center gap-0.5 shrink-0 ${paddingClass} rounded-lg transition-all ${
        isBookmarked
          ? "text-sky-500"
          : "text-muted-foreground/50 hover:text-sky-400"
      }`}
      title={isBookmarked ? "Remove bookmark" : "Bookmark this look"}
    >
      <Bookmark
        className={`${sizeClass} transition-all ${isBookmarked ? "fill-sky-500 scale-110" : ""}`}
      />
    </button>
  );
}
