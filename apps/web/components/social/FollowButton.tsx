"use client";

import { BellPlus, BellRing } from "lucide-react";
import { useFollows, type FollowTarget } from "./useFollows";

export function FollowButton({
  target,
  compact = false,
}: {
  target: FollowTarget;
  compact?: boolean;
}) {
  const { isFollowing, toggle } = useFollows();
  const following = isFollowing(target.kind, target.id);

  return (
    <button
      type="button"
      onClick={() => toggle(target)}
      aria-pressed={following}
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold transition-all active:scale-95 ${
        following
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
      } ${compact ? "min-h-9 px-3 text-xs" : "min-h-10 px-4 text-xs"}`}
    >
      {following ? <BellRing className="h-3.5 w-3.5" /> : <BellPlus className="h-3.5 w-3.5" />}
      {following ? "Following" : `Follow ${target.kind === "curator" ? "drop" : "stylist"}`}
    </button>
  );
}
