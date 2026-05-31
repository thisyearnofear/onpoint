"use client";

import { useEffect, useRef } from "react";
import {
  trackCuratorPageView,
  trackCuratorTryOn,
  trackCuratorBuyClick,
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

  // Track page view once on mount
  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;

    trackCuratorPageView({
      curatorSlug: slug,
      curatorName: name,
      listingCount,
      referrer: document.referrer || undefined,
    });
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

  return null;
}
