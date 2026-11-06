import type { Metadata } from "next";
import { verifyInviteToken } from "@/lib/utils/try-on-invite";
import { getApiBase } from "@/lib/utils/api-base";
import { ArtifactShell } from "@/components/surface/ArtifactShell";
import { ExitLinks } from "@/components/surface/ExitLinks";
import { TryInviteClient } from "./TryInviteClient";

export const metadata: Metadata = {
  title: "A look picked for you | OnPoint",
  robots: { index: false },
};

interface Listing {
  id: string;
  title?: string | null;
  imageUrl?: string | null;
  priceCusd?: number | null;
}

async function loadListing(curatorSlug: string, listingId: string): Promise<Listing | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/curator/${encodeURIComponent(curatorSlug)}/storefront`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const listings: Listing[] = data?.listings || data?.items || [];
    return listings.find((l) => l.id === listingId) || null;
  } catch {
    return null;
  }
}

export default async function TryInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = verifyInviteToken(token);
  if (!invite) {
    return (
      <ArtifactShell
        eyebrow="That link ran out"
        title="This invite was used, or it expired."
        lede="One link, one try-on — ask for a fresh one, or style your own."
        exits={<ExitLinks kinds={["make", "board"]} />}
      />
    );
  }

  const listing = await loadListing(invite.curatorSlug, invite.listingId);

  return (
    <ArtifactShell
      eyebrow="Picked for you"
      artifact={
        listing?.imageUrl ? (
          <div className="border border-border bg-card p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={listing.imageUrl}
              alt={listing.title || "The pick"}
              className="w-full object-contain"
            />
          </div>
        ) : undefined
      }
      title={invite.senderName ? `${invite.senderName} styled this for you.` : "Someone styled this for you."}
      lede={
        <>
          {invite.note && <span className="block italic">“{invite.note}”</span>}
          {listing && (
            <span className="mt-1 block text-xs">
              {listing.title || "The pick"}
              {listing.priceCusd != null && ` · ~$${listing.priceCusd.toFixed(2)}`}
            </span>
          )}
        </>
      }
    >
      <div className="mt-6">
        <TryInviteClient
          token={token}
          listingImageUrl={listing?.imageUrl ?? null}
          curatorSlug={invite.curatorSlug}
          listingId={invite.listingId}
          title={listing?.title ?? null}
        />
      </div>
    </ArtifactShell>
  );
}
