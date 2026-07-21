import * as React from "react";
import type { LookItem, SimilarItem } from "./types";

export interface UseLookItemsResult {
  items: LookItem[];
  swapItem: (originalId: string, replacement: SimilarItem, isHero: boolean) => void;
  undo: () => void;
  canUndo: boolean;
}

export function useLookItems(initialItems: LookItem[]): UseLookItemsResult {
  const [history, setHistory] = React.useState<LookItem[][]>([initialItems]);
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const items = history[currentIndex] ?? [];
  const canUndo = currentIndex > 0;

  const swapItem = React.useCallback(
    (originalId: string, replacement: SimilarItem, isHero: boolean) => {
      setHistory((prevHistory) => {
        const currentItems = prevHistory[currentIndex] ?? [];
        const newItems = currentItems.map((item) =>
          item.id === originalId
            ? {
                ...item,
                id: replacement.listingId,
                title: replacement.title,
                curatorSlug: replacement.curatorSlug,
                imageUrl: replacement.imageUrl,
                sizes: replacement.sizes,
                isHero,
              }
            : item,
        );

        const past = prevHistory.slice(0, currentIndex + 1);
        return [...past, newItems];
      });
      setCurrentIndex((prev) => prev + 1);
    },
    [currentIndex],
  );

  const undo = React.useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  return { items, swapItem, undo, canUndo };
}
