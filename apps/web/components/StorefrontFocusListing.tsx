"use client";

import { useEffect } from "react";

/**
 * A Get-it link names the listing it meant (`?item=`). The server has already
 * confirmed that listing is on this shelf and marked it, so this only brings it
 * into view — CuratorTracker's dwell observer counts the high-intent view, and
 * the `sid` already on the URL carries the share attribution.
 */
export function StorefrontFocusListing({ listingId }: { listingId: string | null }) {
  useEffect(() => {
    if (!listingId) return;
    const el = document.getElementById(`listing-${listingId}`);
    if (!el) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [listingId]);
  return null;
}
