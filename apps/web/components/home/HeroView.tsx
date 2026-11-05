"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { captureReferralFromURL } from "../../lib/utils/referral";
import { trackHomepageCta } from "../../lib/utils/analytics";
import { CTA_PLAY } from "../../lib/brand";
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
