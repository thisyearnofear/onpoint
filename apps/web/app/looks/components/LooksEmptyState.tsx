import Link from "next/link";
import { Shirt, Sparkles } from "lucide-react";

interface LooksEmptyStateProps {
  hasActiveFilters: boolean;
}

export function LooksEmptyState({ hasActiveFilters }: LooksEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
      <Shirt className="mb-4 h-12 w-12 text-muted-foreground/30" />
      <h2 className="text-lg font-bold">
        {hasActiveFilters ? "No looks match your filters" : "No looks yet"}
      </h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {hasActiveFilters
          ? "Try a different vibe or clear your filters."
          : "Looks are style boards created from curator inventory. Check back soon or browse curators."}
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        {hasActiveFilters ? (
          <Link
            href="/looks"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background transition-colors hover:bg-foreground/90"
          >
            Browse all looks
          </Link>
        ) : (
          <>
            <Link
              href="/curators"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background transition-colors hover:bg-foreground/90"
            >
              Browse curators
            </Link>
            <Link
              href="/s/nia"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-bold transition-colors hover:bg-muted"
            >
              <Sparkles className="h-4 w-4" />
              Try Nia&apos;s digital looks
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
