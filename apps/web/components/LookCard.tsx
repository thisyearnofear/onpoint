import Link from "next/link";
import { Eye } from "lucide-react";
import { SafeImage } from "./SafeImage";

export interface LookCardItem {
  id: string;
  title: string;
  curatorSlug: string;
  imageUrl: string | null;
  isHero: boolean;
}

export interface LookCardData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  agentAddress: string;
  coverImageKey: string | null;
  coverImageUrl: string | null;
  heroImageUrl: string | null;
  collageUrl: string | null;
  tags: string[];
  tryOnCount: number;
  purchaseCount: number;
  shareCount: number;
  items: LookCardItem[];
}

interface LookCardProps {
  look: LookCardData;
  /** Compact variant for storefronts (smaller padding, fewer tags) */
  compact?: boolean;
}

/**
 * Shared look card — used on /looks, curator storefronts, and "more looks" sections.
 *
 * Image priority: collageUrl → coverImageUrl → heroImageUrl → first item image → placeholder.
 * Tags and stats are shown in a subtle footer below the image (no gradient overlay).
 */
export function LookCard({ look, compact = false }: LookCardProps) {
  const items = look.items ?? [];
  const heroItem = items.find((i) => i.isHero) || items[0];
  const agentShort = look.agentAddress
    ? `${look.agentAddress.slice(0, 6)}…${look.agentAddress.slice(-4)}`
    : "unknown";

  const imageSources = [
    look.collageUrl,
    look.coverImageUrl,
    look.heroImageUrl,
    heroItem?.imageUrl,
  ];

  const maxTags = compact ? 2 : 3;
  const padding = compact ? "p-3" : "p-4";
  const titleSize = compact ? "text-sm" : "text-base";

  return (
    <Link
      href={`/look/${look.slug}`}
      className="group overflow-hidden rounded-2xl border border-border transition-all hover:border-foreground/20 hover:shadow-lg"
    >
      {/* Image — collage or fallback chain */}
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        <SafeImage
          sources={imageSources}
          alt={look.title}
          fill
          unoptimized
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      {/* Footer — title, attribution, tags, stats */}
      <div className={`${padding} space-y-2`}>
        <div>
          <h3 className={`${titleSize} font-bold leading-tight`}>{look.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Styled by {agentShort} · {items.length} pieces
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {look.tags.slice(0, maxTags).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
          {look.tryOnCount > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
              <Eye className="h-3 w-3" />
              {look.tryOnCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
