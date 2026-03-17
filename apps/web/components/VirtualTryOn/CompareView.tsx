"use client";

import React from "react";
import { X } from "lucide-react";
import { Button } from "@repo/ui/button";
import type { LookVersion } from "./LookVersionHistory";

interface CompareViewProps {
  versions: LookVersion[];
  originalPhotoUrl?: string;
  onClose: () => void;
}

export function CompareView({ versions, originalPhotoUrl, onClose }: CompareViewProps) {
  // Build comparison items: original (if available) + selected versions
  const items: { id: string; imageUrl: string; label: string; tips?: string[] }[] = [];

  if (originalPhotoUrl) {
    items.push({ id: "original", imageUrl: originalPhotoUrl, label: "Original" });
  }

  versions.forEach((v, i) => {
    items.push({
      id: v.id,
      imageUrl: v.imageUrl.startsWith("data:") ? v.imageUrl : `data:image/webp;base64,${v.imageUrl}`,
      label: v.label || `Look ${i + 1}`,
      tips: v.stylingTips,
    });
  });

  const cols = items.length <= 2 ? items.length : 3;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Compare Looks</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Grid */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-52px)]">
          <div
            className={`grid gap-4 ${
              cols === 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-3" : "grid-cols-1"
            }`}
          >
            {items.map((item) => (
              <div key={item.id} className="space-y-2">
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-muted">
                  <img
                    src={item.imageUrl}
                    alt={item.label}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 text-xs font-medium bg-background/90 text-foreground rounded-full px-2 py-0.5">
                    {item.label}
                  </div>
                </div>
                {item.tips && item.tips.length > 0 && (
                  <div className="space-y-0.5">
                    {item.tips.slice(0, 2).map((tip, i) => (
                      <p key={i} className="text-[11px] text-muted-foreground line-clamp-2">
                        • {tip}
                      </p>
                    ))}
                    {item.tips.length > 2 && (
                      <p className="text-[10px] text-muted-foreground/60">
                        +{item.tips.length - 2} more tips
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
