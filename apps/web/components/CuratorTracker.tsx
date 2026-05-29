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
 * Invisible — no UI. Attaches click handlers via event delegation.
 */
export function CuratorTracker({
  slug,
  name,
  listingCount,
  listings,
}: CuratorTrackerProps) {
  const trackedRef = useRef(false);
  const listingsRef = useRef(listings);
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

  // Event delegation for try-on and buy clicks (stabilized deps via ref)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const tryOnLink = target.closest<HTMLAnchorElement>("[data-analytics-tryon]");
      const buyLink = target.closest<HTMLAnchorElement>("[data-analytics-buy]");

      if (tryOnLink) {
        const listingId = tryOnLink.dataset.listingId;
        const listing = listingId ? listingsRef.current.find((l) => l.id === listingId) : undefined;
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
        const listing = listingId ? listingsRef.current.find((l) => l.id === listingId) : undefined;
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
