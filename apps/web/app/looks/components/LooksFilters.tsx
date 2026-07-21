import type { ComponentType } from "react";
import Link from "next/link";
import { SlidersHorizontal, TrendingUp, Clock } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { VIBES, OCCASIONS, SEASONS, SORT_OPTIONS } from "../constants";
import { buildHref, type LooksFilters as LooksFiltersType } from "../utils";

const SORT_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  TrendingUp,
  Clock,
};

interface LooksFiltersProps {
  currentFilters: LooksFiltersType;
}

export function LooksFilters({ currentFilters }: LooksFiltersProps) {
  const { category, occasion, season, sort } = currentFilters;
  const activeVibe = category || "";
  const hasActiveFilters = Boolean(category || occasion || season);

  return (
    <div className="space-y-6">
      {/* Sort tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        {SORT_OPTIONS.map(({ value, label, icon }) => {
          const active = (sort || "trending") === value;
          const Icon = SORT_ICONS[icon];
          return (
            <Link
              key={value}
              href={buildHref(currentFilters, { sort: value })}
              className={cn(
                "relative -mb-px inline-flex items-center gap-1.5 px-3 py-2 text-sm font-bold transition-colors",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {label}
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Vibe filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {VIBES.map((v) => {
          const href = v.value
            ? buildHref(currentFilters, { category: v.value })
            : buildHref(currentFilters, { category: "" });
          return (
            <Link
              key={v.value || "all"}
              href={href}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                activeVibe === v.value
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {v.label}
            </Link>
          );
        })}
      </div>

      {/* Occasion + Season refinement */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
            Refine
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {OCCASIONS.map((o) => {
            const active = occasion === o.value;
            if (!o.value) return null;
            const href = active
              ? buildHref(currentFilters, { occasion: "" })
              : buildHref(currentFilters, { occasion: o.value });
            return (
              <Link
                key={o.value}
                href={href}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                  active
                    ? "bg-foreground/80 text-background"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted",
                )}
              >
                {o.label}
              </Link>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          {SEASONS.map((s) => {
            const active = season === s.value;
            if (!s.value) return null;
            const href = active
              ? buildHref(currentFilters, { season: "" })
              : buildHref(currentFilters, { season: s.value });
            return (
                <Link
                  key={s.value}
                  href={href}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                    active
                      ? "bg-foreground/80 text-background"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted",
                  )}
                >
                  {s.label}
                </Link>
              );
          })}
        </div>

        {hasActiveFilters && (
          <Link
            href={buildHref(currentFilters, {
              category: "",
              occasion: "",
              season: "",
            })}
            className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Clear all
          </Link>
        )}
      </div>
    </div>
  );
}
