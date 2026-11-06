import React from "react";
import { cn } from "@repo/ui/lib/utils";

/**
 * The one skeleton block — a pulsing placeholder shape. Compose these
 * into layout-matched skeletons (see PanelSkeleton, AnalysisSkeleton,
 * CommunitySkeleton); don't hand-roll `animate-pulse` divs.
 *
 * Later Tailwind classes win (twMerge), so pass sizing, rounding, and
 * a different bg shade via className:
 *
 *   <Skeleton className="h-4 w-24 rounded bg-muted-foreground/20" />
 *   <Skeleton className="aspect-[3/4] rounded-xl" />
 *
 * `pulse={false}` renders a static placeholder (used where the parent
 * coordinates the pulse timing).
 */
export function Skeleton({
  className,
  pulse = true,
}: {
  className?: string;
  pulse?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(pulse && "animate-pulse", "bg-muted", "rounded", className)}
    />
  );
}
