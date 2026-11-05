import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getApiBase } from "@/lib/utils/api-base";
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
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto max-w-xl px-4 pb-20 pt-14 md:pt-20">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">
          A gift for you
        </p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl">
          {gift.recipientName ? `${gift.recipientName}, this one is yours.` : "This one is yours."}
        </h1>
        {gift.note && (
          <p className="mt-3 text-base italic leading-relaxed text-muted-foreground">
            &ldquo;{gift.note}&rdquo;
          </p>
        )}

        {gift.item && (
          <div className="mt-8 flex items-center gap-4 border border-border bg-card p-4">
            {gift.item.imageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={gift.item.imageUrl} alt={gift.item.title || "Your gift"} className="h-20 w-20 border border-border object-cover" />
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-foreground">{gift.item.title || "The gift"}</p>
              <p className="text-xs text-muted-foreground">Size {gift.item.size}</p>
            </div>
          </div>
        )}

        <div className="mt-6">
          {gift.claimed ? (
            <div className="border border-border bg-card p-6 text-center">
              <p className="font-display text-2xl">Already claimed.</p>
              <a
                href="/couple"
                className="mt-4 inline-flex min-h-10 items-center rounded-full border border-border px-5 text-xs font-bold text-foreground hover:border-foreground"
              >
                Send one back — make a card for them
              </a>
              <p className="mt-2 text-sm text-muted-foreground">
                This gift was claimed — delivery details are on their way to the curator.
              </p>
            </div>
          ) : (
            <GiftClaimClient token={token} />
          )}
        </div>
      </main>
    </div>
  );
}
