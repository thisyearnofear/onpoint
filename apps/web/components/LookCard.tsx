import Link from "next/link";
import { Eye, Sparkles } from "lucide-react";
import { SafeImage } from "./SafeImage";

export interface LookCardItem {
  id: string;
  title: string;
  curatorSlug: string;
  imageUrl: string | null;
  isHero: boolean;
}

export interface LookMetadata {
  category?: string;
  occasion?: string;
  season?: string;
}

export interface LookCardData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  agentAddress: string;
  curatorSlug: string | null;
  coverImageKey: string | null;
  coverImageUrl: string | null;
  heroImageUrl: string | null;
  collageUrl: string | null;
  tags: string[];
  metadata?: LookMetadata | null;
  tryOnCount: number;
  purchaseCount?: number;
  shareCount: number;
  itemCount?: number;
  createdAt: string;
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
 */
export function LookCard({ look, compact = false }: LookCardProps) {
  const items = look.items ?? [];
  const heroItem = items.find((i) => i.isHero) || items[0];

  const imageSources = [
    look.collageUrl,
    look.coverImageUrl,
    look.heroImageUrl,
    heroItem?.imageUrl,
  ];

  const maxTags = compact ? 2 : 3;
  const padding = compact ? "p-3" : "p-4";
  const titleSize = compact ? "text-sm" : "text-base";

  // Prefer curator name; fall back to a friendly default.
  const curatorLabel = look.curatorSlug
    ? `From ${look.curatorSlug}`
    : "OnPoint Stylist";

  return (
    <Link
      href={`/look/${look.slug}`}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-foreground/20 hover:shadow-xl"
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
        {/* Hover overlay CTA */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-black shadow-lg">
            <Sparkles className="h-4 w-4" />
            Try this look
          </span>
        </div>
      </div>

      {/* Footer — title, attribution, badges, tags, stats */}
      <div className={`${padding} space-y-2`}>
        <div>
          <h3 className={`${titleSize} font-bold leading-tight`}>{look.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {curatorLabel} · {items.length || look.itemCount || 0} pieces
          </p>
        </div>

        {/* Structured metadata badges (category, occasion, season) */}
        {look.metadata && (look.metadata.category || look.metadata.occasion || look.metadata.season) && (
          <div className="flex flex-wrap gap-1">
            {look.metadata.category && (
              <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-semibold capitalize text-foreground/70">
                {look.metadata.category}
              </span>
            )}
            {look.metadata.occasion && look.metadata.occasion !== 'casual' && (
              <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-semibold capitalize text-foreground/70">
                {look.metadata.occasion}
              </span>
            )}
            {look.metadata.season && look.metadata.season !== 'all-season' && (
              <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-semibold capitalize text-foreground/70">
                {look.metadata.season}
              </span>
            )}
          </div>
        )}

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
