"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { Palette } from "lucide-react";
import { captureReferralFromURL } from "../../lib/utils/referral";
import { trackHomepageCta } from "../../lib/utils/analytics";
import { CTA_PLAY, PRODUCT_NAME } from "../../lib/brand";
import { WardrobeWorkspace } from "../wardrobe/WardrobeWorkspace";

export function HeroView() {
  useEffect(() => {
    captureReferralFromURL();
  }, []);

  const heroCtaRef = React.useRef<HTMLDivElement | null>(null);
  const [hideCtaPill, setHideCtaPill] = React.useState(true);

  useEffect(() => {
    const targets = [heroCtaRef.current].filter(Boolean) as Element[];
    if (!targets.length || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver(
      (ents) => {
        for (const e of ents) {
          if (e.isIntersecting) visible.add(e.target);
          else visible.delete(e.target);
        }
        setHideCtaPill(visible.size > 0);
      },
      { threshold: 0 },
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div ref={heroCtaRef}>
        <WardrobeWorkspace />
      </div>

      <footer className="border-t border-border/60 py-8">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <div className="rounded-lg bg-gradient-to-br from-primary to-accent p-1 shadow-md">
              <Palette className="h-3.5 w-3.5 text-white" />
            </div>
            {PRODUCT_NAME}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link href="/style-board" className="hover:text-foreground">
              All looks
            </Link>
            <Link href="/developers" className="hover:text-foreground">
              Developers
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em]">
            Earn permission. Report truth.
          </p>
        </div>
      </footer>

      <div
        className={`fixed bottom-4 left-1/2 z-40 -translate-x-1/2 pb-[env(safe-area-inset-bottom)] transition-all duration-300 ease-out md:hidden ${hideCtaPill ? "translate-y-24 opacity-0 pointer-events-none" : "opacity-100"}`}
        aria-hidden={hideCtaPill}
      >
        <Link
          href={CTA_PLAY.href}
          onClick={() =>
            trackHomepageCta({ cta: "play", placement: "mobile_sticky" })
          }
          className="inline-flex h-12 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-6 text-center text-sm font-bold text-white shadow-xl shadow-primary/25 active:scale-[0.98]"
        >
          {CTA_PLAY.mobileLabel} ›
        </Link>
      </div>
    </div>
  );
}
