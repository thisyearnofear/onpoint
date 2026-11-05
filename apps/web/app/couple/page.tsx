import type { Metadata } from "next";
import { getApiBase } from "@/lib/utils/api-base";
import { CoupleClient } from "./CoupleClient";

export const metadata: Metadata = {
  title: "Couple goals — style the two of you | OnPoint",
  description: "One photo of the two of you + a look. A card worth sending.",
};

async function loadLooks(): Promise<Array<{ slug: string; title: string }>> {
  try {
    const res = await fetch(`${getApiBase()}/api/looks?limit=20`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const arr = data?.looks || data || [];
    return arr
      .filter((l: { slug?: string }) => l?.slug)
      .map((l: { slug: string; title?: string }) => ({ slug: l.slug, title: l.title || l.slug }))
      .slice(0, 20);
  } catch {
    return [];
  }
}

export default async function CouplePage() {
  const looks = await loadLooks();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-xl px-4 pb-20 pt-14 md:pt-20">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">
          Couple goals
        </p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl">
          One photo of you two.
          <span className="block text-primary">One look.</span>
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
          Make a card worth sending — and the pieces on it are shoppable.
        </p>
        <div className="mt-8">
          {looks.length > 0 ? (
            <CoupleClient looks={looks} />
          ) : (
            <div className="border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No looks available yet — check back soon.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
