"use client";

import * as React from "react";
import { GridHeader } from "./GridHeader";
import { ItemCard } from "./ItemCard";
import { AlternativesPanel } from "./AlternativesPanel";
import { UndoToast } from "./UndoToast";
import { useLookItems } from "./useLookItems";
import { useAlternatives } from "./useAlternatives";
import type { LookItem, LookItemGridProps } from "./types";

export function LookItemGrid({
  items: initialItems,
  referralCode,
  lookSlug,
  curatorSlug,
}: LookItemGridProps) {
  const { items, swapItem, undo, canUndo } = useLookItems(initialItems);
  const {
    alternatives,
    loading,
    error,
    fetchAlternatives,
  } = useAlternatives();
  const [activeItemId, setActiveItemId] = React.useState<string | null>(null);
  const [showUndo, setShowUndo] = React.useState(false);

  React.useEffect(() => {
    if (!showUndo) return;
    const timer = setTimeout(() => setShowUndo(false), 5000);
    return () => clearTimeout(timer);
  }, [showUndo]);

  const handleSwapRequest = React.useCallback(
    (item: LookItem) => {
      setActiveItemId(item.id);
      const otherItemIds = items.map((i) => i.id).filter((id) => id !== item.id);
      fetchAlternatives(item.id, otherItemIds);
    },
    [fetchAlternatives, items],
  );

  const handleClosePanel = React.useCallback(() => {
    setActiveItemId(null);
  }, []);

  const handleSwap = React.useCallback(
    (originalId: string, replacement: import("./types").SimilarItem, isHero: boolean) => {
      swapItem(originalId, replacement, isHero);
      setShowUndo(true);
      setActiveItemId(null);
    },
    [swapItem],
  );

  const handleUndo = React.useCallback(() => {
    undo();
    setShowUndo(false);
  }, [undo]);

  const activeAlternatives = activeItemId ? alternatives[activeItemId] || [] : [];
  const isLoading = activeItemId ? loading[activeItemId] || false : false;
  const activeError = activeItemId ? error[activeItemId] || null : null;

  return (
    <div className="space-y-4">
      <GridHeader
        items={items}
        curatorSlug={curatorSlug}
        referralCode={referralCode}
        lookSlug={lookSlug}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            referralCode={referralCode}
            lookSlug={lookSlug}
            onSwap={handleSwapRequest}
          />
        ))}
      </div>

      <UndoToast visible={showUndo && canUndo} onUndo={handleUndo} />

      {activeItemId && (
        <AlternativesPanel
          activeItemId={activeItemId}
          items={items}
          alternatives={activeAlternatives}
          loading={isLoading}
          error={activeError}
          referralCode={referralCode}
          lookSlug={lookSlug}
          onClose={handleClosePanel}
          onSwap={handleSwap}
        />
      )}
    </div>
  );
}
