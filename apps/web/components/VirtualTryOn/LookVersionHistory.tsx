"use client";

import React from "react";
import { ChevronLeft, ChevronRight, Columns2 } from "lucide-react";
import { Button } from "@repo/ui/button";

export interface LookVersion {
  id: string;
  imageUrl: string;
  prompt?: string;
  stylingTips?: string[];
  timestamp: number;
  label?: string;
}

interface LookVersionHistoryProps {
  versions: LookVersion[];
  selectedVersionIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onCompare: () => void;
}

export function LookVersionHistory({
  versions,
  selectedVersionIds,
  onToggleSelect,
  onCompare,
}: LookVersionHistoryProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  if (versions.length < 2) return null;

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 180;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  const canCompare = selectedVersionIds.size >= 2;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          Look History ({versions.length})
        </p>
        <Button
          size="sm"
          variant={canCompare ? "default" : "outline"}
          disabled={!canCompare}
          onClick={onCompare}
          className="gap-1.5"
        >
          <Columns2 className="h-3.5 w-3.5" />
          Compare ({selectedVersionIds.size})
        </Button>
      </div>

      <div className="relative">
        {/* Scroll buttons */}
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-background/90 border shadow-sm flex items-center justify-center hover:bg-background transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-background/90 border shadow-sm flex items-center justify-center hover:bg-background transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        {/* Scrollable strip */}
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-1"
          style={{ scrollbarWidth: "none" }}
        >
          {versions.map((version, i) => {
            const isSelected = selectedVersionIds.has(version.id);
            return (
              <button
                key={version.id}
                onClick={() => onToggleSelect(version.id)}
                className={`flex-shrink-0 relative group rounded-lg overflow-hidden border-2 transition-all ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-transparent hover:border-muted-foreground/30"
                }`}
              >
                <img
                  src={
                    version.imageUrl.startsWith("data:")
                      ? version.imageUrl
                      : `data:image/webp;base64,${version.imageUrl}`
                  }
                  alt={version.label || `Look ${i + 1}`}
                  className="w-24 h-32 object-cover"
                />
                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary bg-background/90 rounded-full w-5 h-5 flex items-center justify-center">
                      {Array.from(selectedVersionIds).indexOf(version.id) + 1}
                    </span>
                  </div>
                )}
                {/* Label */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                  <span className="text-[10px] text-white font-medium">
                    {version.label || `Look ${i + 1}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
