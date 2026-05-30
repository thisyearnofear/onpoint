"use client";

import React from "react";

interface AnalysisSkeletonProps {
  /** When true, each skeleton element gets individual animate-pulse for staggered effect */
  staggered?: boolean;
  /** Whether to show the action buttons section */
  showActions?: boolean;
}

export function AnalysisSkeleton({
  staggered = false,
  showActions = true,
}: AnalysisSkeletonProps) {
  const p = staggered ? " animate-pulse" : "";

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="p-6 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={`h-4 w-4 rounded bg-muted-foreground/20${p}`} />
            <div className={`h-4 w-28 rounded bg-muted-foreground/20${p}`} />
          </div>
          <div className={`h-5 w-16 rounded-full bg-muted-foreground/20${p}`} />
        </div>
        <div className={`h-3 w-40 rounded bg-muted-foreground/20 mt-2${p}`} />
      </div>

      {/* Content */}
      <div className="px-6 pb-6 space-y-3">
        {/* Body Profile */}
        <div className="rounded-lg border p-3 bg-muted/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <div className={`h-3.5 w-3.5 rounded bg-muted-foreground/20${p}`} />
              <div className={`h-3.5 w-20 rounded bg-muted-foreground/20${p}`} />
            </div>
            <div className={`h-4 w-16 rounded-full bg-muted-foreground/20${p}`} />
          </div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-3.5 w-14 rounded bg-muted-foreground/10${p}`}
              />
            ))}
          </div>
        </div>

        {/* Fit & Sizing */}
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <div className={`h-3.5 w-3.5 rounded bg-muted-foreground/20${p}`} />
            <div className={`h-3.5 w-16 rounded bg-muted-foreground/20${p}`} />
          </div>
          <div className={`h-2.5 w-44 rounded bg-muted-foreground/10 mb-2${p}`} />
          <div className="space-y-1.5">
            <div className="flex items-start gap-2">
              <div className={`h-3 w-1.5 rounded bg-muted-foreground/20 mt-0.5${p}`} />
              <div className={`h-3 w-full rounded bg-muted-foreground/10${p}`} />
            </div>
            <div className="flex items-start gap-2">
              <div className={`h-3 w-1.5 rounded bg-muted-foreground/20 mt-0.5${p}`} />
              <div className={`h-3 w-3/4 rounded bg-muted-foreground/10${p}`} />
            </div>
          </div>
        </div>

        {/* Style & Colors */}
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <div className={`h-3.5 w-3.5 rounded bg-muted-foreground/20${p}`} />
            <div className={`h-3.5 w-20 rounded bg-muted-foreground/20${p}`} />
          </div>
          <div className={`h-2.5 w-40 rounded bg-muted-foreground/10 mb-2${p}`} />
          <div className="space-y-1.5">
            <div className="flex items-start gap-2">
              <div className={`h-3 w-1.5 rounded bg-muted-foreground/20 mt-0.5${p}`} />
              <div className={`h-3 w-full rounded bg-muted-foreground/10${p}`} />
            </div>
            <div className="flex items-start gap-2">
              <div className={`h-3 w-1.5 rounded bg-muted-foreground/20 mt-0.5${p}`} />
              <div className={`h-3 w-2/3 rounded bg-muted-foreground/10${p}`} />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {showActions && (
          <div className="pt-2 border-t border-border/50">
            <div className={`h-3 w-16 rounded bg-muted-foreground/20 mx-auto mb-3${p}`} />
            <div className="grid grid-cols-2 gap-2">
              <div className={`h-14 rounded-lg bg-muted-foreground/10${p}`} />
              <div className={`h-14 rounded-lg bg-muted-foreground/10${p}`} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
