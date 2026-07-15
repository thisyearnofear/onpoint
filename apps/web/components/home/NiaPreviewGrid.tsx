"use client";

import { useState, useEffect } from "react";
import { Image as ImageIcon } from "lucide-react";
import { getApiBase } from "../../lib/utils/api-base";

interface NiaListing {
  id: string;
  title: string | null;
  imageUrl: string | null;
  kit?: { club: string } | null;
}

/**
 * Shows a 2×2 grid of real Nia listing images on the homepage.
 * Falls back to placeholder icons while loading or if the API is unreachable.
 */
export function NiaPreviewGrid() {
  const [listings, setListings] = useState<NiaListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const apiBase = getApiBase();
        const res = await fetch(`${apiBase}/api/curator/nia/storefront`);
        if (!res.ok) return;
        const data = await res.json();
        const live = (data.listings || []).filter(
          (l: NiaListing) => l.imageUrl,
        );
        if (!cancelled) setListings(live.slice(0, 4));
      } catch {
        // silent — placeholders will show
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const slots = listings.length > 0 ? listings : Array(4).fill(null);

  return (
    <div className="grid grid-cols-2 gap-2">
      {slots.map((listing, i) => (
        <div
          key={listing?.id || i}
          className="aspect-square rounded-lg bg-gradient-to-br from-accent/20 to-primary/20 border border-accent/10 flex items-center justify-center overflow-hidden"
        >
          {listing?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.imageUrl}
              alt={listing.title || listing.kit?.club || "Nia design"}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <ImageIcon className="h-6 w-6 text-accent/40" />
          )}
        </div>
      ))}
    </div>
  );
}
