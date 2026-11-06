import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getApiBase } from "@/lib/utils/api-base";
import { RecordSeen } from "@/components/RecentlySeen";
import { ShareArtifact } from "@/components/ShareArtifact";
import { ShareAttributionCapture } from "@/components/ShareAttributionCapture";
import { ArtifactShell } from "@/components/surface/ArtifactShell";
import { ItemRow, type SurfaceItem } from "@/components/surface/ItemRow";
import { MoreRail } from "@/components/surface/MoreRail";
import { ExitLinks } from "@/components/surface/ExitLinks";

export const metadata: Metadata = { title: "A list for you | OnPoint" };

interface Wishlist { id: string; kind: string; ownerName: string | null; items: SurfaceItem[] }

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
  let more: SurfaceItem[] = [];
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
    <ArtifactShell
      eyebrow={seeYouIn ? "Things to see you in" : "The wish list"}
      title={
        list.ownerName
          ? seeYouIn
            ? `Picked for ${list.ownerName}.`
            : `${list.ownerName}'s list.`
          : "Picked for you."
      }
      lede={
        <>
          {seeYouIn ? "Try one on — the pieces are real." : "A wish, not a checkout — prices wait for later."}
          <span className="mt-2 block text-xs text-muted-foreground/80">
            This link is the list — whoever has it can add pieces. Keep it between the right people.
          </span>
        </>
      }
      exits={<ExitLinks kinds={["couple", "magazine", "board"]} />}
    >
      <RecordSeen entry={{ kind: "list", title: list.ownerName ? `${list.ownerName}'s list` : "The wish list", href: `/w/${id}` }} />
      <ShareAttributionCapture />

      <div className="mt-8 grid gap-3">
        {list.items.map((item) => (
          <ItemRow key={item.listingId} item={item} from="list" />
        ))}
      </div>

      <MoreRail items={more} />

      <div className="mt-8 flex justify-end">
        <ShareArtifact title={list.ownerName ? `${list.ownerName}'s list` : "The wish list"} text="A list made for you" url={`/w/${id}`} />
      </div>
    </ArtifactShell>
  );
}
