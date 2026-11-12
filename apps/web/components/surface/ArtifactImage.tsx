"use client";

import { useState } from "react";
import { SafeImage } from "../SafeImage";

/**
 * Framed artifact image for receipt/artifact surfaces. Tries `sources` in
 * order via SafeImage; when every candidate fails, the whole frame
 * disappears — no placeholder tile, no empty box.
 */
export function ArtifactImage({
  sources,
  alt,
  aspect = "aspect-[4/3]",
  imageClassName = "object-contain",
}: {
  sources: (string | null | undefined)[];
  alt: string;
  /** Tailwind aspect class for the frame */
  aspect?: string;
  /** object-cover for renders/photos, object-contain for product shots */
  imageClassName?: string;
}) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <div className={`relative border border-border bg-muted/20 ${aspect}`}>
      <SafeImage
        sources={sources}
        alt={alt}
        fill
        priority
        sizes="(max-width: 768px) 100vw, 600px"
        className={imageClassName}
        onAllFailed={() => setGone(true)}
      />
    </div>
  );
}
