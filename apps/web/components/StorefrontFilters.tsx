"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface AttributeFacets {
  type: string[];
  formality: string[];
  warmth: string[];
}

const FILTER_KEYS = ["type", "formality", "warmth"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

const LABELS: Record<FilterKey, string> = {
  type: "Piece",
  formality: "Vibe",
  warmth: "Weight",
};

function formatValue(value: string) {
  return value.replaceAll("-", " ");
}

/**
 * Faceted filter bar for curator storefronts. Reads/writes the same
 * ?type=&formality=&warmth= params the storefront API already understands,
 * so filtered views are shareable links.
 */
export function AttributeFilterBar({
  facets,
  shown,
  total,
}: {
  facets: AttributeFacets;
  shown: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active = (key: FilterKey) =>
    (searchParams.get(key) || "").trim().toLowerCase();

  const hasAnyFacet = FILTER_KEYS.some((key) => facets[key].length > 0);
  const filtering = FILTER_KEYS.some((key) => active(key));

  if (!hasAnyFacet) return null;

  const toggle = (key: FilterKey, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (active(key) === value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const clear = () => {
    const params = new URLSearchParams(searchParams.toString());
    FILTER_KEYS.forEach((key) => params.delete(key));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="mb-6 space-y-2">
      {FILTER_KEYS.filter((key) => facets[key].length > 0).map((key) => (
        <div key={key} className="flex flex-wrap items-center gap-1.5">
          <span className="w-14 shrink-0 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {LABELS[key]}
          </span>
          {facets[key].map((value) => {
            const isActive = active(key) === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggle(key, value)}
                aria-pressed={isActive}
                className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  isActive
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                {formatValue(value)}
              </button>
            );
          })}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        {filtering ? (
          <>
            Showing {shown} of {total}
            <button
              type="button"
              onClick={clear}
              className="ml-2 font-medium text-foreground underline-offset-2 hover:underline"
            >
              Clear filters
            </button>
          </>
        ) : (
          "Filter by piece, vibe, or weight"
        )}
      </p>
    </div>
  );
}
