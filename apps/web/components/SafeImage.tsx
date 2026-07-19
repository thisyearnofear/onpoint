"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Shirt } from "lucide-react";

interface SafeImageProps {
  /** Ordered list of candidate image URLs — tries each in sequence on error */
  sources: (string | null | undefined)[];
  alt: string;
  fill?: boolean;
  unoptimized?: boolean;
  className?: string;
  /** Fallback icon size when all sources fail */
  fallbackIconSize?: number;
  /** Referrer policy passed to next/image (e.g. "no-referrer" for Auth0 avatars) */
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
}

/**
 * Image component with automatic fallback chain and error handling.
 *
 * Tries each URL in `sources` in order. If one fails (404, network error,
 * etc.), moves to the next. If all fail, shows a placeholder icon.
 *
 * This is essential because `keyToUrl()` in the API always returns a URL
 * even when the file doesn't exist in R2 yet (e.g. collageUrl, cutoutUrl).
 * Without this, broken images would show instead of falling back.
 */
export function SafeImage({
  sources,
  alt,
  fill = false,
  unoptimized = false,
  className,
  fallbackIconSize = 48,
  referrerPolicy,
}: SafeImageProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  // Filter to valid URLs only
  const validSources = sources.filter((s): s is string => Boolean(s));
  const sourcesKey = validSources.join(",");

  // Reset when sources change (e.g. navigation to a new look)
  useEffect(() => {
    setCurrentIdx(0);
    setAllFailed(false);
  }, [sourcesKey]);

  if (allFailed || validSources.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Shirt
          className="text-muted-foreground/20"
          style={{ width: fallbackIconSize, height: fallbackIconSize }}
        />
      </div>
    );
  }

  const currentSrc = validSources[currentIdx];
  if (!currentSrc) {
    return (
      <div className="flex h-full items-center justify-center">
        <Shirt
          className="text-muted-foreground/20"
          style={{ width: fallbackIconSize, height: fallbackIconSize }}
        />
      </div>
    );
  }

  return (
    <Image
      src={currentSrc}
      alt={alt}
      fill={fill}
      unoptimized={unoptimized}
      className={className}
      referrerPolicy={referrerPolicy}
      onError={() => {
        if (currentIdx < validSources.length - 1) {
          setCurrentIdx(currentIdx + 1);
        } else {
          setAllFailed(true);
        }
      }}
    />
  );
}
