import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/utils/api-base";
import { RecentlySeenStrip } from "@/components/RecentlySeen";

export const metadata: Metadata = { title: "Fresh cards | OnPoint" };

async function loadCards(): Promise<Array<{ id: string; cardUrl: string; theme: string | null; senderName: string | null }>> {
  try {
    const res = await fetch(`${getApiBase()}/api/loop/cards?limit=24`, { next: { revalidate: 120 }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    return (await res.json()).cards || [];
  } catch {
    return [];
  }
}

export default async function CardsPage() {
  const cards = await loadCards();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-14 md:pt-20">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">Fresh off the board</p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl">Couple cards.</h1>
        <RecentlySeenStrip />
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {cards.map((c, i) => (
            <Link
              key={c.id}
              href={`/c/${c.id}`}
              style={{ animationDelay: `${Math.min(i, 12) * 50}ms` }}
              className="fade-up group border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-foreground hover:shadow-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.cardUrl} alt={c.theme || "Couple card"} className="w-full object-cover" loading="lazy" />
              <span className="block border-t border-border px-3 py-2 text-xs font-bold text-foreground/80 group-hover:text-foreground">
                {c.theme || "Couple goals"}
                {c.senderName && <span className="block font-normal text-muted-foreground">by {c.senderName}</span>}
              </span>
            </Link>
          ))}
        </div>
        {cards.length === 0 && <p className="mt-10 text-sm text-muted-foreground">No cards yet. The first one&apos;s yours to make.</p>}
        <div className="mt-10 text-center">
          <Link href="/couple" className="inline-flex min-h-12 items-center rounded-full bg-primary px-8 text-sm font-bold text-white hover:bg-primary/90">Make yours</Link>
        </div>
      </main>
    </div>
  );
}
