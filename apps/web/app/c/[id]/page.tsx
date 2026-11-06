import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getApiBase } from "@/lib/utils/api-base";
import { SaveItemButton } from "@/components/SaveItemButton";
import { RecordSeen } from "@/components/RecentlySeen";
import { ShareArtifact } from "@/components/ShareArtifact";
import { ShareAttributionCapture } from "@/components/ShareAttributionCapture";
import { ReportCard } from "./ReportCard";

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
  listed: boolean;
  replyTo: string | null;
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
  // Reply threading: when this card answers another, name what it answers.
  const parent = card.replyTo ? await loadCard(card.replyTo) : null;

  const firstSlug = card.items.find((i) => i.curatorSlug)?.curatorSlug;
  let more: CardItem[] = [];
  if (firstSlug) {
    try {
      const res = await fetch(`${getApiBase()}/api/curator/${encodeURIComponent(firstSlug)}/storefront`, {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(5000),
      });
      const sf = res.ok ? await res.json() : null;
      const shown = new Set(card.items.map((i) => i.listingId));
      more = (sf?.listings || [])
        .filter((l: { id: string }) => !shown.has(l.id))
        .slice(0, 4)
        .map((l: { id: string; title?: string; imageUrl?: string }) => ({
          listingId: l.id,
          curatorSlug: firstSlug,
          title: l.title || null,
          imageUrl: l.imageUrl || null,
        }));
    } catch { /* optional rail */ }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <RecordSeen entry={{ kind: "card", title: card.theme || "Couple goals", href: `/c/${id}` }} />
      <ShareAttributionCapture />
      <main className="mx-auto max-w-xl px-4 pb-20 pt-14 md:pt-20">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">
          {card.theme || "Couple goals"}
        </p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl">
          {card.senderName ? `Styled by ${card.senderName}.` : "Styled on OnPoint."}
        </h1>
        {parent && (
          <p className="mt-2 text-xs text-muted-foreground">
            A reply to {parent.senderName ? `${parent.senderName}'s` : "the"} card{parent.theme ? ` — ${parent.theme}` : ""}.
          </p>
        )}

        <div className="card-reveal mt-8 border border-border bg-card p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.cardUrl} alt={`${card.theme || "Couple goals"} card`} className="w-full object-contain" />
        </div>
        <div className="mt-4 flex justify-end">
          <ShareArtifact title={card.theme || "Couple goals"} text="A card made for us" url={`/c/${id}`} />
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
                    {/* from= names whose shelf the garment came from; an item with
                        no known curator falls back to naming itself. */}
                    <Link
                      href={`/lab?tab=try-on&from=${item.curatorSlug || "card"}&item=${item.listingId}`}
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

        {more.length > 0 && (
          <div className="mt-10">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
              More like this
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {more.map((item) => (
                <Link key={item.listingId} href={`/s/${item.curatorSlug}?item=${item.listingId}`} className="group border border-border bg-card transition-colors hover:border-foreground">
                  {item.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.imageUrl} alt={item.title || "Item"} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="aspect-square w-full bg-muted" />
                  )}
                  <span className="block truncate border-t border-border px-3 py-2 text-xs font-bold text-foreground/80 group-hover:text-foreground">{item.title || "Item"}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 border-t border-border pt-6 text-center">
          <Link href={`/couple?reply=${id}`} className="inline-flex min-h-12 items-center rounded-full bg-primary px-8 text-sm font-bold text-white hover:bg-primary/90">
            Send one back
          </Link>
          <Link href="/magazine" className="mt-3 block text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Or send it as a magazine →
          </Link>
          <Link href="/cards" className="mt-3 block text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Or see what others made →
          </Link>
          {card.listed && <ReportCard id={id} />}
        </div>
      </main>
    </div>
  );
}
