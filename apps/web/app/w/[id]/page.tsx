import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getApiBase } from "@/lib/utils/api-base";
import { RecordSeen } from "@/components/RecentlySeen";
import { ShareArtifact } from "@/components/ShareArtifact";
import { ShareAttributionCapture } from "@/components/ShareAttributionCapture";

export const metadata: Metadata = { title: "A list for you | OnPoint" };

interface WishItem { listingId: string; curatorSlug: string | null; title: string | null; imageUrl: string | null }
interface Wishlist { id: string; kind: string; ownerName: string | null; items: WishItem[] }

async function load(id: string): Promise<Wishlist | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/wishlist/${encodeURIComponent(id)}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export default async function WishlistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const list = await load(id);
  if (!list) notFound();
  const seeYouIn = list.kind === "see-you-in";

  const firstSlug = list.items.find((i) => i.curatorSlug)?.curatorSlug;
  let more: WishItem[] = [];
  if (firstSlug) {
    try {
      const res = await fetch(`${getApiBase()}/api/curator/${encodeURIComponent(firstSlug)}/storefront`, {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(5000),
      });
      const sf = res.ok ? await res.json() : null;
      const shown = new Set(list.items.map((i) => i.listingId));
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
      <RecordSeen entry={{ kind: "list", title: list.ownerName ? `${list.ownerName}'s list` : "The wish list", href: `/w/${id}` }} />
      <ShareAttributionCapture />
      <main className="mx-auto max-w-xl px-4 pb-20 pt-14 md:pt-20">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">
          {seeYouIn ? "Things to see you in" : "The wish list"}
        </p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl">
          {list.ownerName ? (seeYouIn ? `Picked for ${list.ownerName}.` : `${list.ownerName}'s list.`) : "Picked for you."}
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          {seeYouIn ? "Try one on — the pieces are real." : "A wish, not a checkout — prices wait for later."}
        </p>
        <p className="mt-2 text-xs text-muted-foreground/80">
          This link is the list — whoever has it can add pieces. Keep it between the right people.
        </p>

        <div className="mt-8 grid gap-3">
          {list.items.map((item) => (
            <div key={item.listingId} className="flex items-center justify-between gap-4 border border-border bg-card p-4">
              <div className="flex min-w-0 items-center gap-4">
                {item.imageUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={item.imageUrl} alt={item.title || "Item"} className="h-14 w-14 border border-border object-cover" />
                )}
                <p className="truncate text-sm font-bold text-foreground">{item.title || "The piece"}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link href={`/lab?tab=try-on&from=${item.curatorSlug || "list"}&item=${item.listingId}`} className="inline-flex min-h-10 items-center rounded-full bg-primary px-4 text-xs font-bold text-white hover:bg-primary/90">
                  Try it on
                </Link>
                {item.curatorSlug && (
                  <Link href={`/s/${item.curatorSlug}?item=${item.listingId}`} className="inline-flex min-h-10 items-center rounded-full border border-border px-4 text-xs font-bold text-foreground hover:border-foreground">
                    Get it
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        {more.length > 0 && (
          <div className="mt-10">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">More like this</p>
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

        <div className="mt-8 flex justify-end">
          <ShareArtifact title={list.ownerName ? `${list.ownerName}'s list` : "The wish list"} text="A list made for you" url={`/w/${id}`} />
        </div>

        <div className="mt-10 border-t border-border pt-6 text-center">
          <Link href="/couple" className="inline-flex min-h-12 items-center rounded-full bg-primary px-8 text-sm font-bold text-white hover:bg-primary/90">
            Make a card together
          </Link>
          <Link href="/magazine" className="mt-3 block text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Or send it as a magazine →
          </Link>
          <Link href="/cards" className="mt-3 block text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Or see what others made →
          </Link>
        </div>
      </main>
    </div>
  );
}
