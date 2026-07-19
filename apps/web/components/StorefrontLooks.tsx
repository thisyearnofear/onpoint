import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getApiBase } from "../lib/utils/api-base";
import { LookCard, type LookCardData } from "./LookCard";

export const dynamic = "force-dynamic";

async function loadLooksForCurator(slug: string): Promise<LookCardData[]> {
  try {
    const res = await fetch(
      `${getApiBase()}/api/looks?curator=${encodeURIComponent(slug)}&limit=6`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.looks || [];
  } catch {
    return [];
  }
}

export async function StorefrontLooks({ curatorSlug }: { curatorSlug: string }) {
  const looks = await loadLooksForCurator(curatorSlug);

  if (looks.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Sparkles className="h-5 w-5 text-foreground/60" />
            Styled Looks
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Style boards featuring this curator&apos;s collection — created by agents. Try on and share.
          </p>
        </div>
        <Link
          href={`/looks?curator=${curatorSlug}`}
          className="shrink-0 text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
        >
          View all →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {looks.map((look) => (
          <LookCard key={look.id} look={look} compact />
        ))}
      </div>
    </div>
  );
}
