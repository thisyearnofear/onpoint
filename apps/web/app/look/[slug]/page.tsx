import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  TrendingUp,
  Share2,
  Sparkles,
} from "lucide-react";
import { getApiBase } from "../../../lib/utils/api-base";
import { OnPointLayout } from "../../../components/OnPointLayout";
import { SafeImage } from "../../../components/SafeImage";
import { LookCard, type LookCardData } from "../../../components/LookCard";
import { ShareBar } from "./ShareBar";

export const dynamic = "force-dynamic";

interface LookItem {
  id: string;
  title: string;
  curatorSlug: string;
  imageUrl: string | null;
  isHero: boolean;
  sizes: Array<{ size: string; stock: number; price: number }>;
  tags: string[];
  kit: { club: string; kitType: string; brand: string } | null;
}

interface LookMetadata {
  category?: string;
  occasion?: string;
  season?: string;
}

interface Look {
  id: string;
  agentAddress: string;
  slug: string;
  title: string;
  description: string | null;
  curatorSlug: string | null;
  listingIds: string[];
  heroListingId: string | null;
  coverImageKey: string | null;
  coverImageUrl: string | null;
  collageUrl: string | null;
  tags: string[];
  metadata?: LookMetadata | null;
  status: string;
  tryOnCount: number;
  purchaseCount: number;
  shareCount: number;
  items: LookItem[];
  referralCode: string;
  shareUrl: string;
}

async function loadLook(slug: string): Promise<Look | null> {
  const res = await fetch(
    `${getApiBase()}/api/looks/${encodeURIComponent(slug)}`,
    { cache: "no-store" },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load look: ${res.status}`);
  return res.json();
}

async function loadMoreFromCurator(
  curatorSlug: string,
  excludeSlug: string,
): Promise<LookCardData[]> {
  try {
    const res = await fetch(
      `${getApiBase()}/api/looks?curator=${encodeURIComponent(curatorSlug)}&limit=4`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.looks || []).filter((l: LookCardData) => l.slug !== excludeSlug);
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const look = await loadLook(slug).catch(() => null);

  if (!look) {
    return { title: "Look not found | OnPoint" };
  }

  const ogImage = look.collageUrl || look.coverImageUrl || look.items?.find((i) => i.imageUrl)?.imageUrl;

  return {
    title: `${look.title} | OnPoint Looks`,
    description: look.description || `A styled look by ${look.agentAddress ? look.agentAddress.slice(0, 8) + "…" : "an agent"} on OnPoint`,
    openGraph: {
      images: ogImage ? [ogImage] : [],
    },
  };
}

function getLowestPrice(sizes: LookItem["sizes"]): number | null {
  if (!sizes || sizes.length === 0) return null;
  const prices = sizes.map((s) => s.price).filter((p) => p > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}

export default async function LookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const look = await loadLook(slug);

  if (!look) notFound();

  const items = look.items || [];
  const heroItem = items.find((i) => i.isHero) || items[0];
  const moreLooks = look.curatorSlug
    ? await loadMoreFromCurator(look.curatorSlug, look.slug)
    : [];
  const agentShort = look.agentAddress
    ? `${look.agentAddress.slice(0, 6)}…${look.agentAddress.slice(-4)}`
    : "unknown";

  const heroImageSources = [
    look.collageUrl,
    look.coverImageUrl,
    heroItem?.imageUrl,
  ];

  const totalPrice = items.reduce((sum, item) => {
    const price = getLowestPrice(item.sizes);
    return sum + (price || 0);
  }, 0);

  return (
    <OnPointLayout footer={false}>
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Back link */}
        <Link
          href="/looks"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All looks
        </Link>

        {/* Title + description — editorial header */}
        <div className="mb-6 space-y-3">
          <h1 className="text-3xl font-black tracking-tight md:text-5xl">
            {look.title}
          </h1>
          {look.description && (
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              {look.description}
            </p>
          )}

          {/* Structured metadata badges */}
          {look.metadata && (look.metadata.category || look.metadata.occasion || look.metadata.season) && (
            <div className="flex flex-wrap gap-2">
              {look.metadata.category && (
                <Link
                  href={`/looks?category=${look.metadata.category}`}
                  className="rounded-full bg-foreground/5 px-3 py-1 text-xs font-semibold capitalize text-foreground/70 transition-colors hover:bg-foreground/10"
                >
                  {look.metadata.category}
                </Link>
              )}
              {look.metadata.occasion && look.metadata.occasion !== 'casual' && (
                <Link
                  href={`/looks?occasion=${look.metadata.occasion}`}
                  className="rounded-full bg-foreground/5 px-3 py-1 text-xs font-semibold capitalize text-foreground/70 transition-colors hover:bg-foreground/10"
                >
                  {look.metadata.occasion.replace('-', ' ')}
                </Link>
              )}
              {look.metadata.season && look.metadata.season !== 'all-season' && (
                <Link
                  href={`/looks?season=${look.metadata.season}`}
                  className="rounded-full bg-foreground/5 px-3 py-1 text-xs font-semibold capitalize text-foreground/70 transition-colors hover:bg-foreground/10"
                >
                  {look.metadata.season}
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Hero collage — full-bleed on mobile, centered on desktop */}
        <div className="mb-6">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted md:max-w-md md:mx-auto">
            <SafeImage
              sources={heroImageSources}
              alt={look.title}
              fill
              unoptimized
              className="object-cover"
              fallbackIconSize={64}
            />
          </div>
        </div>

        {/* Stats bar — subtle, below the image */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            Styled by{" "}
            <span className="font-mono font-medium text-foreground">
              {agentShort}
            </span>
          </span>
          <span className="text-border">·</span>
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-4 w-4" />
            {look.tryOnCount} try-ons
          </span>
          <span className="text-border">·</span>
          <span className="inline-flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" />
            {look.purchaseCount} purchases
          </span>
          <span className="text-border">·</span>
          <span className="inline-flex items-center gap-1.5">
            <Share2 className="h-4 w-4" />
            {look.shareCount} shares
          </span>
        </div>

        {/* Try-on CTA — prominent */}
        {heroItem && (
          <div className="mb-8 rounded-2xl border border-border bg-muted/50 p-6 text-center">
            <h2 className="mb-2 text-xl font-bold">Try on this look</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Upload a photo and see how {heroItem.title} looks on you.
              Get a shareable collage card for Instagram.
            </p>
            <Link
              href={`/s/${heroItem.curatorSlug}?tryOn=${heroItem.id}&referral=${look.referralCode}&look=${look.slug}`}
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-6 py-3 text-sm font-bold text-background transition-colors hover:bg-foreground/90"
            >
              <Eye className="h-4 w-4" />
              Try on {heroItem.title}
            </Link>
          </div>
        )}

        {/* Items — visual grid of cutouts */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              The Look ({items.length} pieces)
            </h2>
            {totalPrice > 0 && (
              <span className="text-sm font-bold">
                Total: KES {totalPrice.toLocaleString()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => {
              const price = getLowestPrice(item.sizes);
              return (
                <Link
                  key={item.id}
                  href={`/s/${item.curatorSlug}?referral=${look.referralCode}&look=${look.slug}#${item.id}`}
                  className="group space-y-2"
                >
                  <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted transition-all group-hover:border-foreground/20 group-hover:shadow-md">
                    <SafeImage
                      sources={[item.imageUrl]}
                      alt={item.title}
                      fill
                      unoptimized
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      fallbackIconSize={32}
                    />
                    {item.isHero && (
                      <span className="absolute left-2 top-2 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold uppercase text-background">
                        Hero
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-bold leading-tight line-clamp-2">
                      {item.title}
                    </h3>
                    <p className="text-[11px] capitalize text-muted-foreground">
                      {item.curatorSlug}
                      {item.kit?.brand && ` · ${item.kit.brand}`}
                    </p>
                    {price && (
                      <p className="text-xs font-bold">
                        KES {price.toLocaleString()}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* More from this curator */}
        {moreLooks.length > 0 && (
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                More from {look.curatorSlug}
              </h2>
              <Link
                href={`/looks?curator=${look.curatorSlug}`}
                className="text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
              >
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {moreLooks.map((otherLook) => (
                <LookCard key={otherLook.id} look={otherLook} compact />
              ))}
            </div>
          </div>
        )}

        {/* Tags + Share — bottom section */}
        <div className="flex flex-col gap-6 border-t border-border pt-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {look.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/looks?tag=${tag}`}
                  className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium capitalize text-muted-foreground transition-colors hover:bg-muted/80"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-2 sm:w-64">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Share
            </h3>
            <ShareBar title={look.title} shareUrl={look.shareUrl} />
          </div>
        </div>
      </div>
    </OnPointLayout>
  );
}
