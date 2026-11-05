import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getApiBase } from "@/lib/utils/api-base";
import { SaveItemButton } from "@/components/SaveItemButton";

export const metadata: Metadata = {
  title: "Couple goals | OnPoint",
};

interface CardItem {
  listingId: string;
  curatorSlug: string | null;
  title: string | null;
  imageUrl: string | null;
}

interface CoupleCard {
  id: string;
  cardUrl: string;
  theme: string | null;
  senderName: string | null;
  items: CardItem[];
  createdAt: string;
}

async function loadCard(id: string): Promise<CoupleCard | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/couple/card/${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function CoupleCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await loadCard(id);
  if (!card) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-xl px-4 pb-20 pt-14 md:pt-20">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">
          {card.theme || "Couple goals"}
        </p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl">
          {card.senderName ? `Styled by ${card.senderName}.` : "Styled on OnPoint."}
        </h1>

        <div className="card-reveal mt-8 border border-border bg-card p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.cardUrl} alt={`${card.theme || "Couple goals"} card`} className="w-full object-contain" />
        </div>

        {card.items.length > 0 && (
          <div className="mt-10">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
              On the card
            </p>
            <div className="mt-4 grid gap-3">
              {card.items.map((item) => (
                <div key={item.listingId} className="flex items-center justify-between gap-4 border border-border bg-card p-4">
                  <div className="flex min-w-0 items-center gap-4">
                    {item.imageUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={item.imageUrl} alt={item.title || "Item"} className="h-14 w-14 border border-border object-cover" />
                    )}
                    <p className="truncate text-sm font-bold text-foreground">{item.title || "The piece"}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      href={`/lab?tab=try-on&from=card&item=${item.listingId}`}
                      className="inline-flex min-h-10 items-center rounded-full bg-primary px-4 text-xs font-bold text-white hover:bg-primary/90"
                    >
                      Try it on
                    </Link>
                    {item.curatorSlug && (
                      <Link
                        href={`/s/${item.curatorSlug}?item=${item.listingId}`}
                        className="inline-flex min-h-10 items-center rounded-full border border-border px-4 text-xs font-bold text-foreground hover:border-foreground"
                      >
                        Get it
                      </Link>
                    )}
                    <SaveItemButton item={item} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 border-t border-border pt-6 text-center">
          <Link href="/couple" className="inline-flex min-h-12 items-center rounded-full bg-primary px-8 text-sm font-bold text-white hover:bg-primary/90">
            Make your own
          </Link>
        </div>
      </main>
    </div>
  );
}
