import { Clock } from "lucide-react";

/**
 * Small "Coming Soon" badge for features that aren't fully shipped yet.
 * Use inline next to feature mentions that aren't yet live.
 */
export function ComingSoonBadge({
  label = "Coming Soon",
  size = "sm",
}: {
  label?: string;
  size?: "xs" | "sm";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 font-medium text-amber-600 dark:text-amber-400 ${
        size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      }`}
    >
      <Clock className={size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {label}
    </span>
  );
}
