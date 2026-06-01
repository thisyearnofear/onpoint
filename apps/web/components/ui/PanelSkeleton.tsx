"use client";

import React from "react";

interface PanelSkeletonProps {
  /** Layout variant matching the target panel */
  variant: "shop" | "market-intel" | "settings";
  /** When true, skeleton elements get staggered animate-pulse */
  staggered?: boolean;
}

export function PanelSkeleton({ variant, staggered = false }: PanelSkeletonProps) {
  const p = staggered ? " animate-pulse" : "";

  if (variant === "shop") {
    return (
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className={`h-7 w-16 rounded bg-muted-foreground/20${p}`} />
            <div className={`h-4 w-56 rounded bg-muted-foreground/10${p}`} />
          </div>
          <div className={`h-10 w-10 rounded-full bg-muted-foreground/10${p}`} />
        </div>

        {/* AI Picks section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className={`h-4 w-4 rounded bg-muted-foreground/20${p}`} />
            <div className={`h-4 w-24 rounded bg-muted-foreground/20${p}`} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className={`aspect-[3/4] rounded-xl bg-muted-foreground/10${p}`} />
                <div className={`h-3 w-3/4 rounded bg-muted-foreground/15${p}`} />
                <div className={`h-3 w-1/2 rounded bg-muted-foreground/10${p}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Full Catalog */}
        <div className="space-y-4">
          <div className={`h-5 w-32 rounded bg-muted-foreground/20${p}`} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-2">
                <div className={`aspect-[3/4] rounded-xl bg-muted-foreground/10${p}`} />
                <div className={`h-3 w-4/5 rounded bg-muted-foreground/15${p}`} />
                <div className={`h-3 w-2/5 rounded bg-muted-foreground/10${p}`} />
                <div className={`h-4 w-1/3 rounded bg-muted-foreground/15${p}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "market-intel") {
    return (
      <div className="space-y-5 animate-fade-in">
        {/* Header */}
        <div className="space-y-2">
          <div className={`h-4 w-44 rounded bg-muted-foreground/20${p}`} />
          <div className={`h-8 w-64 rounded bg-muted-foreground/20${p}`} />
          <div className={`h-4 w-96 rounded bg-muted-foreground/10${p}`} />
        </div>

        {/* Search bar */}
        <div className={`h-11 w-full max-w-xs rounded-xl bg-muted-foreground/10${p}`} />

        {/* Summary stat cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-24 rounded-xl bg-muted-foreground/10${p}`} />
          ))}
        </div>

        {/* Two-column layout */}
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          {/* Signals column */}
          <div className="space-y-3">
            <div className={`h-5 w-24 rounded bg-muted-foreground/20${p}`} />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`h-32 rounded-xl bg-muted-foreground/10${p}`} />
            ))}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`h-44 rounded-xl bg-muted-foreground/10${p}`} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "settings") {
    return (
      <div className="space-y-5 animate-fade-in">
        {/* Title */}
        <div className="space-y-2">
          <div className={`h-7 w-20 rounded bg-muted-foreground/20${p}`} />
          <div className={`h-4 w-56 rounded bg-muted-foreground/10${p}`} />
        </div>

        {/* Wallet & Social section */}
        <div className={`rounded-2xl border border-border p-4 space-y-3`}>
          <div className="flex items-center gap-2">
            <div className={`h-4 w-4 rounded bg-muted-foreground/20${p}`} />
            <div className={`h-4 w-32 rounded bg-muted-foreground/20${p}`} />
          </div>
          <div className={`h-8 w-full rounded-lg bg-muted-foreground/10${p}`} />
          <div className="flex gap-2">
            <div className={`h-10 w-36 rounded-full bg-muted-foreground/10${p}`} />
            <div className={`h-10 w-36 rounded-full bg-muted-foreground/10${p}`} />
          </div>
        </div>

        {/* Connected Accounts section */}
        <div className={`rounded-2xl border border-border p-4 space-y-3`}>
          <div className="flex items-center gap-2">
            <div className={`h-4 w-4 rounded bg-muted-foreground/20${p}`} />
            <div className={`h-4 w-36 rounded bg-muted-foreground/20${p}`} />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className={`h-16 rounded-xl bg-muted-foreground/10${p}`} />
          ))}
        </div>

        {/* Subscription section */}
        <div className={`rounded-2xl border border-border p-4 space-y-3`}>
          <div className="flex items-center gap-2">
            <div className={`h-4 w-4 rounded bg-muted-foreground/20${p}`} />
            <div className={`h-4 w-28 rounded bg-muted-foreground/20${p}`} />
          </div>
          <div className={`h-10 w-full rounded-xl bg-muted-foreground/10${p}`} />
        </div>

        {/* Security section */}
        <div className={`rounded-2xl border border-border p-4 space-y-3`}>
          <div className="flex items-center gap-2">
            <div className={`h-4 w-4 rounded bg-muted-foreground/20${p}`} />
            <div className={`h-4 w-48 rounded bg-muted-foreground/20${p}`} />
          </div>
          <div className={`h-24 w-full rounded-xl bg-muted-foreground/10${p}`} />
        </div>
      </div>
    );
  }

  return null;
}
