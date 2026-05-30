"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Button } from "@repo/ui/button";
import { Check, Search, Sparkles } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { TryOnSelection } from "../../lib/utils/try-on-selection";
import { trackTryOnGarmentSelected } from "../../lib/utils/analytics";

type SelectableGarment = TryOnSelection & {
  selectionKey: string;
};

function formatTryOnPrice(price?: number) {
  if (!price) return null;
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(price);
}

function sourceLabel(source?: string) {
  if (!source) return "Catalog";
  if (source.startsWith("storefront:")) return "Storefront";
  return source.charAt(0).toUpperCase() + source.slice(1);
}

interface GarmentPickerProps {
  garmentOptions: SelectableGarment[];
  selectedGarmentKey: string | null;
  onSelectGarment: (item: SelectableGarment, method?: "carousel" | "change_garment") => void;
  onGenerateTryOn: () => void;
  tryOnLoading: boolean;
}

export function GarmentPicker({
  garmentOptions,
  selectedGarmentKey,
  onSelectGarment,
  onGenerateTryOn,
  tryOnLoading,
}: GarmentPickerProps) {
  const [garmentSearch, setGarmentSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "catalog" | "storefront">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const garmentScrollRef = useRef<HTMLDivElement>(null);

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          garmentOptions
            .map((item) => item.category)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [garmentOptions],
  );

  const filteredGarments = useMemo(() => {
    const query = garmentSearch.trim().toLowerCase();
    return garmentOptions.filter((item) => {
      if (sourceFilter === "catalog" && item.source !== "catalog") return false;
      if (sourceFilter === "storefront" && !item.source?.startsWith("storefront:")) {
        return false;
      }
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (!query) return true;
      return `${item.name} ${item.description} ${item.category || ""}`
        .toLowerCase()
        .includes(query);
    });
  }, [categoryFilter, garmentOptions, garmentSearch, sourceFilter]);

  const garmentVirtualizer = useVirtualizer({
    count: filteredGarments.length,
    getScrollElement: () => garmentScrollRef.current,
    estimateSize: () => 120,
    horizontal: true,
    overscan: 3,
  });

  // Scroll to selected garment when auto-selected
  React.useEffect(() => {
    if (!selectedGarmentKey) return;
    const index = filteredGarments.findIndex(
      (g) => g.selectionKey === selectedGarmentKey,
    );
    if (index >= 0) {
      garmentVirtualizer.scrollToIndex(index, { align: "start" });
    }
  }, [selectedGarmentKey, filteredGarments, garmentVirtualizer]);

  const selectedGarment =
    garmentOptions.find((item) => item.selectionKey === selectedGarmentKey) || null;

  const selectGarment = useCallback(
    (item: SelectableGarment) => {
      onSelectGarment(item, "carousel");
    },
    [onSelectGarment],
  );

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-primary">
          {selectedGarment ? "Selected for try-on" : "Choose a garment"}
        </p>
        <span className="rounded-full border border-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
          {selectedGarment ? "Ready" : "Required"}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_120px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={garmentSearch}
            onChange={(event) => setGarmentSearch(event.target.value)}
            placeholder="Search garments"
            className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none focus:border-primary"
          />
        </label>
        <select
          value={sourceFilter}
          onChange={(event) =>
            setSourceFilter(event.target.value as "all" | "catalog" | "storefront")
          }
          className="h-9 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
        >
          <option value="all">All sources</option>
          <option value="catalog">Catalog</option>
          <option value="storefront">Storefront</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
        >
          <option value="all">All categories</option>
          {categoryOptions.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>
      {selectedGarment ? (
        <div className="mt-2 flex gap-3">
          {selectedGarment.imageUrl && (
            <img
              src={selectedGarment.imageUrl}
              alt={selectedGarment.name}
              className="h-16 w-16 rounded-md object-cover"
            />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium">{selectedGarment.name}</p>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {selectedGarment.description}
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                {sourceLabel(selectedGarment.source)}
              </span>
              {selectedGarment.category && (
                <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                  {selectedGarment.category}
                </span>
              )}
              {formatTryOnPrice(selectedGarment.price) && (
                <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                  {formatTryOnPrice(selectedGarment.price)}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : null}
      <div
        ref={garmentScrollRef}
        className="mt-3 overflow-x-auto pb-1"
        style={{ height: "164px" }}
      >
        {filteredGarments.length === 0 ? (
          <div className="flex h-full min-w-full items-center justify-center rounded-lg border border-dashed border-border bg-background text-xs text-muted-foreground">
            No garments match those filters
          </div>
        ) : (
          <div
            style={{
              width: `${garmentVirtualizer.getTotalSize()}px`,
              height: "100%",
              position: "relative",
            }}
          >
            {garmentVirtualizer.getVirtualItems().map((virtualItem) => {
              const item = filteredGarments[virtualItem.index];
              if (!item) return null;
              const isSelected = item.selectionKey === selectedGarmentKey;
              const price = formatTryOnPrice(item.price);
              return (
                <button
                  key={item.selectionKey}
                  type="button"
                  onClick={() => selectGarment(item)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    transform: `translateX(${virtualItem.start}px)`,
                    width: `${virtualItem.size}px`,
                    height: "100%",
                  }}
                  className={`relative rounded-lg border bg-background p-2 text-left transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="aspect-square overflow-hidden rounded-md bg-muted">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <p className="mt-2 truncate text-xs font-medium">{item.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {sourceLabel(item.source)}
                    {price ? ` · ${price}` : ""}
                  </p>
                  {isSelected && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-primary p-1 text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="mt-4">
        <Button
          className="w-full bg-gradient-to-r from-primary to-accent"
          disabled={tryOnLoading || !selectedGarment}
          onClick={onGenerateTryOn}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {tryOnLoading ? "Generating Try-On..." : "Generate AI Try-On"}
        </Button>
      </div>
    </div>
  );
}
