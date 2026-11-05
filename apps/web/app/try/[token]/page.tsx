import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyInviteToken } from "@/lib/utils/try-on-invite";
import { getApiBase } from "@/lib/utils/api-base";
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
  if (!invite) notFound();

  const listing = await loadListing(invite.curatorSlug, invite.listingId);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-xl px-4 pb-20 pt-14 md:pt-20">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">
          Picked for you
        </p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl">
          {invite.senderName ? `${invite.senderName} styled this for you.` : "Someone styled this for you."}
        </h1>
        {invite.note && (
          <p className="mt-3 text-base italic leading-relaxed text-muted-foreground">
            &ldquo;{invite.note}&rdquo;
          </p>
        )}

        {listing && (
          <div className="mt-8 flex items-center gap-4 border border-border bg-card p-4">
            {listing.imageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={listing.imageUrl} alt={listing.title || "The item"} className="h-20 w-20 border border-border object-cover" />
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-foreground">{listing.title || "The pick"}</p>
              {listing.priceCusd != null && (
                <p className="text-xs text-muted-foreground">~${listing.priceCusd.toFixed(2)}</p>
              )}
            </div>
          </div>
        )}

        <div className="mt-6">
          <TryInviteClient token={token} listingImageUrl={listing?.imageUrl ?? null} />
        </div>
      </main>
    </div>
  );
}
