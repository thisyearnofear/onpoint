"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { STYLE_OUTFITS } from "../../lib/style-board";

/**
 * The style board — curated AI-generated outfit references (not inventory).
 * Each card deep-links into Runway as a sample so it can be judged without a photo.
 * ?pick=<outfit-id> highlights the look "the fix" recommended.
 */
export function StyleBoard() {
  const params = useSearchParams();
  const pick = params.get("pick");
  const pickRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (pick && pickRef.current) {
      pickRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [pick]);

  return (
    <div className="container mx-auto px-4 py-14 md:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">The style board</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">Looks worth stealing.</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          AI-generated outfit references — styling ideas, not items for sale. Tap one and the Runway judges will score it, or bring your own fit.
        </p>

        {pick && (
          <div className="mt-6 rounded-2xl border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
            The judges think you&apos;d score higher in something like the highlighted look — or{" "}
            <Link href="/runway/play" className="font-bold text-primary hover:underline">play with your own photo</Link>.
          </div>
        )}

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {STYLE_OUTFITS.map((o) => (
            <Link
              key={o.id}
              href={`/runway/play?sample=${o.id}`}
              ref={o.id === pick ? pickRef : undefined}
              className={`group overflow-hidden rounded-2xl border bg-card transition-colors hover:border-primary/60 ${
                o.id === pick ? "border-primary ring-2 ring-primary/40" : "border-border/60"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.src} alt={o.title} className="aspect-[2/3] w-full bg-zinc-100 object-cover dark:bg-zinc-900" loading="lazy" />
              <div className="px-3 py-2.5">
                <p className="truncate text-xs font-bold">{o.title}</p>
                <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{o.tags.slice(0, 3).join(" · ")}</p>
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-10 max-w-xl text-xs text-muted-foreground">
          Outfit renders adapted from the open-source{" "}
          <a href="https://github.com/paipiange/nvzhuang" target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-2 hover:text-foreground">
            nvzhuang
          </a>{" "}
          dataset (MIT). Real, purchasable garments live in{" "}
          <Link href="/shop" className="font-bold underline underline-offset-2 hover:text-foreground">the shop</Link>{" "}
          and on{" "}
          <Link href="/curators" className="font-bold underline underline-offset-2 hover:text-foreground">curator storefronts</Link>.
        </p>
      </div>
    </div>
  );
}
