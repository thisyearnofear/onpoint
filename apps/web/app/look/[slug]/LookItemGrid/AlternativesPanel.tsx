import * as React from "react";
import { X, Loader2 } from "lucide-react";
import { SimilarItemCard } from "./SimilarItemCard";
import type { SimilarItem } from "./types";

interface AlternativesPanelProps {
  activeItemId: string;
  items: { id: string; isHero: boolean }[];
  alternatives: SimilarItem[];
  loading: boolean;
  error: string | null;
  referralCode: string;
  lookSlug: string;
  onClose: () => void;
  onSwap: (originalId: string, replacement: SimilarItem, isHero: boolean) => void;
}

export function AlternativesPanel({
  activeItemId,
  items,
  alternatives,
  loading,
  error,
  referralCode,
  lookSlug,
  onClose,
  onSwap,
}: AlternativesPanelProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="relative rounded-2xl border border-border bg-muted/30 p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold">Swap this piece for…</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close alternatives"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Finding similar items…
        </div>
      )}

      {error && (
        <p className="py-2 text-sm text-destructive">{error}</p>
      )}

      {!loading && alternatives.length === 0 && !error && (
        <p className="py-2 text-sm text-muted-foreground">
          No similar items found right now. Try another piece.
        </p>
      )}

      {!loading && alternatives.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {alternatives.map((alt) => {
            const original = items.find((i) => i.id === activeItemId);
            return (
              <SimilarItemCard
                key={alt.listingId}
                alt={alt}
                referralCode={referralCode}
                lookSlug={lookSlug}
                onUse={() =>
                  onSwap(activeItemId, alt, original?.isHero ?? false)
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
