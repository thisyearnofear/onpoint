"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Shirt } from "lucide-react";

/** Hosts the Next optimizer is allowed to fetch (mirrors next.config.js remotePatterns). */
const OPTIMIZABLE_SUFFIXES = ["r2.dev", "api.onpoint.famile.xyz"];

/**
 * Whether a src can go through the Next image optimizer. data:/blob: URLs
 * can never be optimized; same-origin paths always can; remote hosts only
 * when they match remotePatterns (otherwise Next throws at render).
 * Exported for tests.
 */
export function isOptimizableImageSrc(src: string): boolean {
  if (src.startsWith("data:") || src.startsWith("blob:")) return false;
  if (src.startsWith("/")) return true;
  try {
    const u = new URL(src);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return OPTIMIZABLE_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
  } catch {
    return false;
  }
}

interface SafeImageProps {
  /** Ordered list of candidate image URLs — tries each in sequence on error */
  sources: (string | null | undefined)[];
  alt: string;
  fill?: boolean;
  /** Force unoptimized (default: auto — optimize allowlisted remote + local, skip data:/blob:/unknown hosts) */
  unoptimized?: boolean;
  /** Responsive sizes hint for fill images (defaults to 100vw) */
  sizes?: string;
  /** Mark the LCP image so it preloads */
  priority?: boolean;
  className?: string;
  /** Fallback icon size when all sources fail */
  fallbackIconSize?: number;
  /** Referrer policy passed to next/image (e.g. "no-referrer" for Auth0 avatars) */
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  /** Called once when every source has failed — lets the caller drop the frame entirely */
  onAllFailed?: () => void;
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
  sizes,
  priority = false,
  className,
  fallbackIconSize = 48,
  referrerPolicy,
  onAllFailed,
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

  // Notify once every source has failed (incl. an empty source list).
  const failed = allFailed || validSources.length === 0;
  const notified = useRef(false);
  useEffect(() => {
    if (failed && !notified.current) {
      notified.current = true;
      onAllFailed?.();
    }
  }, [failed, onAllFailed]);

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
      unoptimized={unoptimized || !isOptimizableImageSrc(currentSrc)}
      sizes={fill ? (sizes ?? "100vw") : sizes}
      priority={priority}
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
