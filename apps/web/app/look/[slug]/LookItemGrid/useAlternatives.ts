import * as React from "react";
import { getApiBase } from "../../../../lib/utils/api-base";
import type { SimilarItem } from "./types";

export interface UseAlternativesResult {
  alternatives: Record<string, SimilarItem[]>;
  loading: Record<string, boolean>;
  error: Record<string, string | null>;
  fetchAlternatives: (itemId: string, otherItemIds: string[]) => void;
}

export function useAlternatives(): UseAlternativesResult {
  const apiBase = getApiBase();
  const [alternatives, setAlternatives] = React.useState<Record<string, SimilarItem[]>>({});
  const [loading, setLoading] = React.useState<Record<string, boolean>>({});
  const [error, setError] = React.useState<Record<string, string | null>>({});

  const fetchAlternatives = React.useCallback(
    (itemId: string, otherItemIds: string[]) => {
      if (alternatives[itemId]) {
        return;
      }

      setLoading((prev) => ({ ...prev, [itemId]: true }));
      setError((prev) => ({ ...prev, [itemId]: null }));

      const excludeIds = otherItemIds.join(",");
      const url = `${apiBase}/api/items/similar?listingId=${encodeURIComponent(
        itemId,
      )}&excludeIds=${encodeURIComponent(excludeIds)}&limit=4`;

      fetch(url, { cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`Failed to fetch alternatives: ${res.status}`);
          }
          const data = await res.json();
          setAlternatives((prev) => ({
            ...prev,
            [itemId]: data.similarItems || [],
          }));
        })
        .catch((err) => {
          setError((prev) => ({
            ...prev,
            [itemId]: err instanceof Error ? err.message : "Unknown error",
          }));
        })
        .finally(() => {
          setLoading((prev) => ({ ...prev, [itemId]: false }));
        });
    },
    [alternatives, apiBase],
  );

  return { alternatives, loading, error, fetchAlternatives };
}
