"use client";

import React from "react";
import Link from "next/link";
import { ItemRow } from "@/components/surface/ItemRow";
import { Lookbook, Cover, Spread, BackPage } from "@/components/lookbook";
import type { LookbookPage } from "@/components/lookbook";
import type { MagazineData } from "./page";

export function Flipbook({ mag }: { mag: MagazineData }) {
  const pages: LookbookPage[] = [];

  // Cover — she's the star. object-contain: the person is never cropped.
  pages.push({
    key: "cover",
    label: "Cover",
    node: (
      <Cover
        eyebrow={`Issue Nº ${mag.issue || 1}`}
        title={mag.recipientName ? `For ${mag.recipientName}.` : "For you."}
        byline={mag.senderName ? `by ${mag.senderName}` : undefined}
      >
        {mag.photoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={mag.photoUrl}
            alt={mag.recipientName || "The cover star"}
            className="max-h-full max-w-full border border-border object-contain"
          />
        ) : (
          <div className="border border-border bg-muted/40 px-10 py-16">
            <p className="font-display text-3xl italic text-foreground/70">{mag.recipientName || "you"}</p>
          </div>
        )}
      </Cover>
    ),
  });

  // Item spreads — two per page
  const items = mag.items || [];
  for (let i = 0; i < items.length; i += 2) {
    const pair = items.slice(i, i + 2);
    pages.push({
      key: `spread-${i}`,
      label: `The pieces · ${i / 2 + 1}`,
      node: (
        <Spread eyebrow={`The pieces · ${i / 2 + 1}`}>
          <div className="grid flex-1 grid-rows-2 gap-4">
            {pair.map((item) => (
              <div key={item.listingId} className="relative flex min-h-0 items-center">
                {item.listingId === mag.heroListingId && (
                  <span className="absolute -top-2 right-3 z-10 border border-primary/40 bg-primary px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-white">
                    Picked for you
                  </span>
                )}
                <div className="w-full">
                  <ItemRow item={item} from="mag" variant="compact" />
                </div>
              </div>
            ))}
          </div>
        </Spread>
      ),
    });
  }

  // Back cover — the note + the return path
  pages.push({
    key: "back",
    label: "The last page",
    node: (
      <BackPage>
        {mag.note ? (
          <p className="font-display text-2xl italic leading-snug text-foreground">&ldquo;{mag.note}&rdquo;</p>
        ) : (
          <p className="font-display text-2xl italic text-foreground/70">Made for you.</p>
        )}
        {mag.senderName && <p className="text-xs font-bold text-muted-foreground">— {mag.senderName}</p>}
        <Link
          href={`/magazine?reply=${mag.id}`}
          className="mt-2 inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-8 text-sm font-bold text-white hover:bg-primary/90"
        >
          Send one back
        </Link>
      </BackPage>
    ),
  });

  return <Lookbook pages={pages} />;
}
