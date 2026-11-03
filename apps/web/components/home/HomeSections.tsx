"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SafeImage } from "../SafeImage";
import { RUNWAY_SAMPLES } from "../../lib/runway-samples";
import { getApiBase } from "../../lib/utils/api-base";

interface NiaListing { id: string; title: string | null; imageUrl: string | null; }

const NIA_FALLBACK: NiaListing[] = [
  { id: "f1", title: "Graphic 01", imageUrl: "/assets/1Product.png" },
  { id: "f2", title: "Graphic 02", imageUrl: "/assets/2Product.png" },
  { id: "f3", title: "Graphic 03", imageUrl: "/assets/3Product.png" },
];

/** 'Pick an outfit. See the verdict.' — sample outfits → /runway/play?sample=id */
function TryItSection() {
  return (
    <section id="try-it" className="scroll-mt-20 border-t border-border/40 bg-background">
      <div className="container mx-auto px-4 py-14 md:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Try it in 10 seconds</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">Pick an outfit. See the verdict.</h2>
          <p className="mt-3 max-w-lg text-sm text-muted-foreground">No camera needed — tap a sample and the judges take it from there.</p>
          <div className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-6">
            {RUNWAY_SAMPLES.map((smp) => (
              <Link
                key={smp.id}
                href={`/runway/play?sample=${smp.id}`}
                className="group w-40 shrink-0 snap-start overflow-hidden rounded-2xl border border-border/60 bg-card transition-colors hover:border-primary/60 md:w-auto"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={smp.src} alt={smp.label} className="aspect-[3/4] w-full object-cover" loading="lazy" />
                <span className="block px-3 py-2 text-xs font-bold">{smp.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** 'Designs you can try on' — Nia gallery with watermark-hiding crop. */
function NiaGallery() {
  const [items, setItems] = useState<NiaListing[]>(NIA_FALLBACK);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getApiBase()}/api/curator/nia/storefront`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return;
        const data = await res.json();
        const live = (data.listings || []).filter((l: NiaListing) => l.imageUrl);
        if (!cancelled && live.length) setItems(live.slice(0, 8));
      } catch { /* fallback stays */ }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="border-t border-border/40 bg-muted/15">
      <div className="container mx-auto px-4 py-14 md:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">The catalog</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">Designs you can try on.</h2>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                <div className="relative aspect-[4/5] overflow-hidden bg-zinc-950">
                  {/* scale ~1.12 anchored top-right hides the Venice watermark corner */}
                  <SafeImage
                    sources={[item.imageUrl || ""]}
                    alt={item.title || "Garment"}
                    fill
                    className="origin-top-right scale-[1.12] object-cover"
                    fallbackIconSize={28}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <p className="truncate text-xs font-bold">{item.title || "Untitled"}</p>
                  <Link
                    href={`/lab?tab=try-on&from=nia${item.id.startsWith("f") ? "" : `&item=${item.id}`}`}
                    className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-4 text-xs font-bold text-white hover:bg-primary/90"
                  >
                    Try on
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const POWERS = [
  { title: "Runway", copy: "A judged fit check — theme, photo, verdict.", href: "/runway", img: "/demo/demo-card-2.png", wide: true },
  { title: "Try-on", copy: "See the garment on you, not a model.", href: "/lab?tab=try-on&from=nia", img: "/demo/sample-street-layers.jpg" },
  { title: "Looks", copy: "Compose and share style boards.", href: "/looks", collage: true },
  { title: "Outfit planner", copy: "Agents ask 'what should I wear Saturday?'", href: "/developers", planner: true },
  { title: "Share cards", copy: "Story + feed cards for Instagram and X.", href: "/runway", img: "/demo/demo-card-1.png", wide: true },
  { title: "Agents", copy: "Shop with permission via MCP/x402/UCP.", href: "#agent-search", terminal: true },
];

/** 'One wardrobe, six superpowers' capability tiles. */
function PowersSection() {
  return (
    <section id="superpowers" className="scroll-mt-20 border-t border-border/40 bg-background">
      <div className="container mx-auto px-4 py-14 md:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">The whole product</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">One wardrobe, six superpowers.</h2>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {POWERS.map((p) => (
              <Link key={p.title} href={p.href} className="group overflow-hidden rounded-2xl border border-border/60 bg-card transition-colors hover:border-primary/60">
                <div className="relative aspect-[4/5] overflow-hidden bg-zinc-950">
                  {p.collage ? (
                    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-zinc-800">
                      {["/assets/1Product.png","/assets/2Product.png","/assets/3Product.png","/assets/1Model.png"].map((src)=>(
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={src} src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                      ))}
                    </div>
                  ) : p.planner ? (
                    <div className="flex h-full w-full flex-col items-stretch justify-center gap-3 bg-zinc-950 p-3">
                      <span className="self-center rounded-full border border-zinc-700 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wide text-zinc-300">Saturday · 24°C · casual</span>
                      <div className="flex justify-center gap-2">
                        {["/assets/1Product.png","/assets/2Product.png","/assets/3Product.png"].map((src)=>(
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={src} src={src} alt="" loading="lazy" className="h-24 w-[4.5rem] rounded-lg border border-zinc-700 object-cover" />
                        ))}
                      </div>
                      <p className="text-center font-mono text-[10px] text-zinc-400">Score 8.4 · 3 items</p>
                    </div>
                  ) : p.terminal ? (
                    <div className="flex h-full w-full flex-col justify-center gap-1.5 bg-zinc-950 p-3 font-mono text-[10px] leading-relaxed">
                      <p className="text-zinc-500">$ <span className="text-zinc-300">POST /api/curator/nia/order</span></p>
                      <p className="text-amber-300/90">402 · pay 4.00 cUSD</p>
                      <p className="text-emerald-300/90">✓ approved · receipt #A1F3</p>
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.img} alt={p.title} loading="lazy" className={`h-full w-full ${p.wide ? "object-contain bg-zinc-950 p-3" : "object-cover"}`} />
                  )}
                </div>
                <div className="flex items-start justify-between gap-2 px-3 py-3">
                  <div>
                    <h3 className="text-sm font-bold">{p.title}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.copy}</p>
                  </div>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeSections() {
  return (
    <>
      <TryItSection />
      <NiaGallery />
      <PowersSection />
    </>
  );
}
