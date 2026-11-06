import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getApiBase } from "@/lib/utils/api-base";
import { ArtifactShell } from "@/components/surface/ArtifactShell";
import { ExitLinks } from "@/components/surface/ExitLinks";
import { GiftClaimClient } from "./GiftClaimClient";

export const metadata: Metadata = {
  title: "A gift for you | OnPoint",
  robots: { index: false },
};

interface GiftView {
  claimed: boolean;
  recipientName: string | null;
  note: string | null;
  item: { title: string | null; imageUrl: string | null; size: string } | null;
}

async function loadGift(token: string): Promise<GiftView | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/gift/${encodeURIComponent(token)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function GiftPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const gift = await loadGift(token);
  if (!gift) notFound();

  return (
    <ArtifactShell
      eyebrow="A gift for you"
      artifact={
        gift.item?.imageUrl ? (
          <div className="border border-border bg-card p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={gift.item.imageUrl}
              alt={gift.item.title || "Your gift"}
              className="w-full object-contain"
            />
          </div>
        ) : undefined
      }
      title={gift.recipientName ? `${gift.recipientName}, this one is yours.` : "This one is yours."}
      lede={
        <>
          {gift.note && <span className="block italic">“{gift.note}”</span>}
          {gift.item && (
            <span className="mt-1 block text-xs">
              {gift.item.title || "The gift"} · Size {gift.item.size}
            </span>
          )}
        </>
      }
      exits={
        gift.claimed ? <ExitLinks kinds={["couple"]} /> : undefined
      }
    >
      <div className="mt-6">
        {gift.claimed ? (
          <div className="border border-border bg-card p-6 text-center">
            <p className="font-display text-2xl">Already claimed.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This gift was claimed — delivery details are on their way to the curator.
            </p>
          </div>
        ) : (
          <GiftClaimClient token={token} />
        )}
      </div>
    </ArtifactShell>
  );
}
