"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Heart } from "lucide-react";
import { STYLE_OUTFITS, type StyleOutfit } from "../../lib/style-board";
import { useStyleHearts } from "../../lib/stores/style-board-hearts";

function OutfitCard({ outfit, picked }: { outfit: StyleOutfit; picked: boolean }) {
  const hearts = useStyleHearts((s) => s.hearts);
  const toggle = useStyleHearts((s) => s.toggle);
  const hearted = hearts.includes(outfit.id);
  const ref = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (picked) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [picked]);

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-card transition-colors hover:border-primary/60 ${
        picked ? "border-primary ring-2 ring-primary/40" : "border-border/60"
      }`}
    >
      <Link ref={ref} href={`/runway/play?sample=${outfit.id}`} className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={outfit.src} alt={outfit.title} className="aspect-[2/3] w-full bg-zinc-100 object-cover dark:bg-zinc-900" loading="lazy" />
      </Link>
      <button
        type="button"
        onClick={() => toggle(outfit.id)}
        aria-label={hearted ? `Unsave ${outfit.title}` : `Save ${outfit.title} to my picks`}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950/70 text-zinc-200 backdrop-blur transition-colors hover:text-primary"
      >
        <Heart className={`h-4 w-4 ${hearted ? "fill-primary text-primary" : ""}`} />
      </button>
      <div className="px-3 py-2.5">
        <p className="truncate text-xs font-bold">{outfit.title}</p>
        <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{outfit.tags.slice(0, 3).join(" · ")}</p>
      </div>
    </div>
  );
}

/**
 * The style board — curated AI-generated outfit references (not inventory).
 * Each card deep-links into Runway as a sample so it can be judged without a photo.
 * ?pick=<outfit-id> highlights the look "the fix" recommended.
 */
export function StyleBoard() {
  const params = useSearchParams();
  const pick = params.get("pick");
  const hearts = useStyleHearts((s) => s.hearts);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const myPicks = mounted ? STYLE_OUTFITS.filter((o) => hearts.includes(o.id)) : [];

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

        {myPicks.length > 0 && (
          <div className="mt-8">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">My picks</p>
            <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
              {myPicks.map((o) => (
                <Link key={o.id} href={`/runway/play?sample=${o.id}`} className="w-28 shrink-0 snap-start overflow-hidden rounded-xl border border-primary/40 bg-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.src} alt={o.title} className="aspect-[2/3] w-full bg-zinc-100 object-cover dark:bg-zinc-900" loading="lazy" />
                  <span className="block truncate px-2.5 py-1.5 text-[11px] font-bold">{o.title}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {STYLE_OUTFITS.map((o) => (
            <OutfitCard key={o.id} outfit={o} picked={o.id === pick} />
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
