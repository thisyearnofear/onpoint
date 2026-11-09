import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getApiBase } from "@/lib/utils/api-base";
import { RecordSeen } from "@/components/RecentlySeen";
import { ShareArtifact } from "@/components/ShareArtifact";
import { ReactionBar } from "@/components/social/ReactionBar";
import { ShareAttributionCapture } from "@/components/ShareAttributionCapture";
import { ArtifactShell } from "@/components/surface/ArtifactShell";
import { ItemRow, type SurfaceItem } from "@/components/surface/ItemRow";
import { MoreRail } from "@/components/surface/MoreRail";
import { ExitLinks } from "@/components/surface/ExitLinks";
import { ReportCard } from "./ReportCard";

export const metadata: Metadata = {
  title: "Couple goals | OnPoint",
};

interface CoupleCard {
  id: string;
  cardUrl: string;
  theme: string | null;
  senderName: string | null;
  items: SurfaceItem[];
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
  let more: SurfaceItem[] = [];
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
    <ArtifactShell
      eyebrow={card.theme || "Couple goals"}
      artifact={
        <div className="card-reveal border border-border bg-card p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.cardUrl} alt={`${card.theme || "Couple goals"} card`} className="w-full object-contain" />
        </div>
      }
      title={card.senderName ? `Styled by ${card.senderName}.` : "Styled on OnPoint."}
      lede={
        parent
          ? `A reply to ${parent.senderName ? `${parent.senderName}'s` : "the"} card${parent.theme ? ` — ${parent.theme}` : ""}.`
          : undefined
      }
      exits={
        <>
          <ExitLinks kinds={["reply", "pair", "magazine", "board"]} id={id} />
          {card.listed && (
            <div className="mt-4 text-center">
              <ReportCard id={id} />
            </div>
          )}
        </>
      }
    >
      <RecordSeen entry={{ kind: "card", title: card.theme || "Couple goals", href: `/c/${id}` }} />
      <ShareAttributionCapture />

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <ReactionBar targetType="card" targetId={id} />
        <ShareArtifact title={card.theme || "Couple goals"} text="A card made for us" url={`/c/${id}`} imageUrl={card.cardUrl} label="Share" />
      </div>

      {card.items.length > 0 && (
        <div className="mt-10">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
            On the card
          </p>
          <div className="mt-4 grid gap-3">
            {card.items.map((item) => (
              <ItemRow key={item.listingId} item={item} from="card" />
            ))}
          </div>
        </div>
      )}

      <MoreRail items={more} />
    </ArtifactShell>
  );
}
