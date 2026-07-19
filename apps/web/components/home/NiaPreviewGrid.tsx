"use client";

import { useState, useEffect } from "react";
import { Image as ImageIcon, Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { getApiBase } from "../../lib/utils/api-base";
import { SafeImage } from "../SafeImage";

interface NiaListing {
  id: string;
  title: string | null;
  imageUrl: string | null;
  kit?: { club: string } | null;
}

/**
 * Shows a 2×2 grid of real Nia listing images on the homepage.
 * Each image is clickable — goes straight to try-on with that design pre-selected.
 * Falls back to placeholder icons while loading or if the API is unreachable.
 */
export function NiaPreviewGrid() {
  const [listings, setListings] = useState<NiaListing[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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

  const handleTryOn = (listingId: string) => {
    router.push(`/lab?tab=try-on&from=nia&item=${listingId}`);
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {slots.map((listing, i) => (
        <button
          key={listing?.id || i}
          type="button"
          disabled={!listing?.id}
          onClick={() => listing?.id && handleTryOn(listing.id)}
          className="group relative aspect-square rounded-lg bg-gradient-to-br from-accent/20 to-primary/20 border border-accent/10 flex items-center justify-center overflow-hidden transition-all hover:border-primary/40 hover:ring-2 hover:ring-primary/20 disabled:cursor-default"
        >
          {listing?.imageUrl ? (
            <>
              <SafeImage
                sources={[listing.imageUrl]}
                alt={listing.title || listing.kit?.club || "Nia design"}
                fill
                unoptimized
                className="object-cover transition-transform group-hover:scale-105"
              />
              {/* Hover overlay with try-on CTA */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 bg-white text-black font-bold text-xs px-3 py-1.5 rounded-full">
                  <Camera className="w-3.5 h-3.5" />
                  Try on
                </span>
              </div>
            </>
          ) : (
            <ImageIcon className="h-6 w-6 text-accent/40" />
          )}
        </button>
      ))}
    </div>
  );
}
