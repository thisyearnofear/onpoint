import type { Metadata } from "next";
import { getApiBase } from "@/lib/utils/api-base";
import { MagazineClient } from "./MagazineClient";

export const metadata: Metadata = {
  title: "Send her a magazine | OnPoint",
  description: "A personal fashion magazine — she's the cover, the pieces are real.",
};

async function loadLooks(): Promise<Array<{ slug: string; title: string }>> {
  try {
    const res = await fetch(`${getApiBase()}/api/looks?limit=20`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.looks || data || [])
      .filter((l: { slug?: string }) => l?.slug)
      .map((l: { slug: string; title?: string }) => ({ slug: l.slug, title: l.title || l.slug }))
      .slice(0, 20);
  } catch {
    return [];
  }
}

export default async function MagazinePage({ searchParams }: { searchParams: Promise<{ reply?: string }> }) {
  const { reply } = await searchParams;
  const looks = await loadLooks();
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto max-w-xl px-4 pb-20 pt-14 md:pt-20">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">The issue of one</p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl">
          A magazine, made for her.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
          Her name on the cover. Real pieces inside. A note on the back page. Send the link — it opens like a magazine, not a checkout.
        </p>
        <div className="mt-8">
          {looks.length > 0 ? (
            <MagazineClient looks={looks} replyTo={reply || null} />
          ) : (
            <div className="border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No pieces to feature yet — new stock lands soon.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
