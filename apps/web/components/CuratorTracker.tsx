"use client";

import { useEffect, useRef } from "react";
import {
  trackCuratorPageView,
  trackCuratorTryOn,
  trackCuratorBuyClick,
  trackCuratorShare,
} from "../lib/utils/analytics";

interface CuratorTrackerProps {
  slug: string;
  name: string;
  listingCount: number;
  listings: Array<{
    id: string;
    club: string;
    kitType: string;
    lowestPrice: number | null;
    checkoutType: string;
  }>;
}

/**
 * Client component that tracks Curator funnel analytics.
 * Invisible — no UI. Attaches click handlers via event delegation
 * and tracks high-intent listing views via IntersectionObserver.
 */
export function CuratorTracker({
  slug,
  name,
  listingCount,
  listings,
}: CuratorTrackerProps) {
  const trackedRef = useRef(false);
  const listingsRef = useRef(listings);
  const notifiedViews = useRef(new Set<string>());
  const dwellTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  listingsRef.current = listings;

  // Track page view once on mount + handle share→visit referral
  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;

    trackCuratorPageView({
      curatorSlug: slug,
      curatorName: name,
      listingCount,
      referrer: document.referrer || undefined,
    });

    // Also fire page_view to Redis funnel analytics
    fetch("/api/curator/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "page_view", curatorSlug: slug }),
    }).catch(() => {});

    // Detect share or cross-curator referral: ?ref=share:<slug> or ?ref=cross:<slug>
    const params = new URLSearchParams(window.location.search);
    const refParam = params.get("ref");
    if (refParam) {
      const isShare = refParam.startsWith("share:");
      const isCross = refParam.startsWith("cross:");
      if ((isShare || isCross) && refParam.length > 6) {
        const sourceSlug = refParam.slice(6);
        if (sourceSlug && sourceSlug !== slug) {
          // Cross-curator visit — fire and forget
          fetch("/api/curator/analytics/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "share_visit",
              shareSourceSlug: sourceSlug,
              visitorCuratorSlug: slug,
            }),
          }).catch(() => {});
        }
      }
    }
  }, [slug, name, listingCount]);

  // IntersectionObserver for high-intent listing views
  useEffect(() => {
    const VIEW_DWELL_MS = 5000;
    const timers = dwellTimers.current;
    const notified = notifiedViews.current;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const article = entry.target as HTMLElement;
          const listingId = article.dataset.listingId;
          if (!listingId) continue;

          if (entry.isIntersecting) {
            // Start dwell timer if not already notified
            if (notified.has(listingId)) continue;
            if (timers.has(listingId)) continue;

            const listing = listingsRef.current.find(
              (l) => l.id === listingId,
            );
            if (!listing) continue;

            const timer = setTimeout(() => {
              notified.add(listingId);
              timers.delete(listingId);

              // Fire notification via API
              fetch("/api/curator/views", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  curatorSlug: slug,
                  listingId: listing.id,
                  club: listing.club,
                  kitType: listing.kitType,
                }),
              }).catch(() => {
                // Silently fail — analytics should never block UX
              });
            }, VIEW_DWELL_MS);

            timers.set(listingId, timer);
          } else {
            // Element left viewport — cancel dwell timer
            const timer = timers.get(listingId);
            if (timer) {
              clearTimeout(timer);
              timers.delete(listingId);
            }
          }
        }
      },
      {
        rootMargin: "0px",
        threshold: 0.6, // 60% visible counts as intersecting
      },
    );

    // Observe all listing articles
    const articles = document.querySelectorAll<HTMLElement>(
      "article[data-listing-id]",
    );
    articles.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      // Clear all pending timers on unmount
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, [slug]);

  // Event delegation for try-on and buy clicks (stabilized deps via ref)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const tryOnLink = target.closest<HTMLAnchorElement>(
        "[data-analytics-tryon]",
      );
      const buyLink = target.closest<HTMLAnchorElement>(
        "[data-analytics-buy]",
      );

      if (tryOnLink) {
        const listingId = tryOnLink.dataset.listingId;
        const listing = listingId
          ? listingsRef.current.find((l) => l.id === listingId)
          : undefined;
        if (listing) {
          trackCuratorTryOn({
            curatorSlug: slug,
            listingId: listing.id,
            club: listing.club,
            kitType: listing.kitType,
          });
        }
      }

      if (buyLink) {
        const listingId = buyLink.dataset.listingId;
        const listing = listingId
          ? listingsRef.current.find((l) => l.id === listingId)
          : undefined;
        if (listing) {
          trackCuratorBuyClick({
            curatorSlug: slug,
            listingId: listing.id,
            club: listing.club,
            kitType: listing.kitType,
            price: listing.lowestPrice,
            checkoutType: listing.checkoutType,
          });
        }
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [slug]);

  // Listen for custom share events from ShareStorefront
  useEffect(() => {
    const handleShare = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.method || !detail?.curatorSlug) return;

      trackCuratorShare({
        curatorSlug: detail.curatorSlug,
        method: detail.method as "whatsapp" | "copy" | "native",
      });
    };

    document.addEventListener("curator-share", handleShare);
    return () => document.removeEventListener("curator-share", handleShare);
  }, []);

  return null;
}
