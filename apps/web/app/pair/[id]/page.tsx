import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getApiBase } from "@/lib/utils/api-base";
import { RecordSeen } from "@/components/RecentlySeen";
import { ShareArtifact } from "@/components/ShareArtifact";
import { ReactionBar } from "@/components/social/ReactionBar";
import { FirstBadge } from "@/components/social/FirstBadge";
import { ShareAttributionCapture } from "@/components/ShareAttributionCapture";
import { ArtifactShell } from "@/components/surface/ArtifactShell";
import { ItemRow, type SurfaceItem } from "@/components/surface/ItemRow";
import { MoreRail } from "@/components/surface/MoreRail";
import { ExitLinks } from "@/components/surface/ExitLinks";
import { PairJoinClient } from "./PairJoinClient";

export const metadata: Metadata = { title: "Same fit, both of us | OnPoint" };

interface PairGarment {
  kind?: string;
  listingId?: string;
  curatorSlug?: string | null;
  title?: string;
  imageUrl?: string;
}

interface PairCard {
  id: string;
  status: string;
  caption: string | null;
  senderName: string | null;
  recipientName: string | null;
  garment: PairGarment | null;
  senderRenderUrl: string | null;
  recipientRenderUrl: string | null;
  cardUrl: string | null;
  replyTo: string | null;
  createdAt: string;
}

async function loadPair(id: string): Promise<PairCard | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/pair/${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function PairPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pair = await loadPair(id);
  if (!pair) notFound();

  const garmentItem: SurfaceItem[] =
    pair.garment?.listingId && pair.garment.curatorSlug
      ? [
          {
            listingId: pair.garment.listingId,
            curatorSlug: pair.garment.curatorSlug,
            title: pair.garment.title || null,
            imageUrl: pair.garment.imageUrl || null,
          },
        ]
      : [];

  const firstSlug = pair.garment?.curatorSlug || undefined;
  let more: SurfaceItem[] = [];
  if (firstSlug) {
    try {
      const res = await fetch(`${getApiBase()}/api/curator/${encodeURIComponent(firstSlug)}/storefront`, {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(5000),
      });
      const sf = res.ok ? await res.json() : null;
      const shown = new Set(garmentItem.map((i) => i.listingId));
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

  const complete = pair.status === "complete" && pair.cardUrl;
  const senderLabel = pair.senderName || "Someone";

  return (
    <ArtifactShell
      eyebrow={pair.caption || "Pair check"}
      artifact={
        complete ? (
          <div className="card-reveal border border-border bg-card p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pair.cardUrl!} alt="Pair card" className="w-full object-contain" />
          </div>
        ) : (
          <div className="space-y-4">
            {pair.senderRenderUrl && (
              <div className="card-reveal overflow-hidden rounded-lg border border-border bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pair.senderRenderUrl} alt={`${senderLabel}'s try-on`} className="w-full object-cover" />
                <p className="px-4 py-3 text-xs text-muted-foreground">
                  {senderLabel} already tried it on{pair.garment?.title ? ` — ${pair.garment.title}` : ""}.
                </p>
              </div>
            )}
            <PairJoinClient
              pair={{
                id: pair.id,
                senderName: pair.senderName,
                caption: pair.caption,
                garment: pair.garment,
                senderRenderUrl: pair.senderRenderUrl,
              }}
            />
          </div>
        )
      }
      title={
        complete
          ? "Same fit, both of us."
          : `${senderLabel} sent you a fit.`
      }
      lede={
        complete
          ? pair.recipientName
            ? `You and ${pair.recipientName} — one card.`
            : "One card, both of you."
          : "Your turn — try the same piece on and the card makes itself."
      }
      exits={
        complete ? (
          <>
            <ExitLinks kinds={["couple", "magazine", "board", "pair"]} />
          </>
        ) : undefined
      }
    >
      <RecordSeen entry={{ kind: "card", title: pair.caption || "Pair card", href: `/pair/${id}` }} />
      <ShareAttributionCapture />

      <FirstBadge />
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <ReactionBar targetType="pair" targetId={id} />
        <ShareArtifact
          title={complete ? "Same fit, both of us" : "Try this on you"}
          text={pair.caption || "A pair card on OnPoint"}
          url={`/pair/${id}`}
          imageUrl={pair.cardUrl}
          label="Share"
        />
      </div>

      {garmentItem.length > 0 && (
        <div className="mt-10">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
            The shared piece
          </p>
          <div className="mt-4 grid gap-3">
            {garmentItem.map((item) => (
              <ItemRow key={item.listingId} item={item} from="pair" />
            ))}
          </div>
        </div>
      )}

      <MoreRail items={more} />
    </ArtifactShell>
  );
}
