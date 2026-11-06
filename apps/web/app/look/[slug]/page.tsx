import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { getApiBase } from "../../../lib/utils/api-base";
import { OnPointLayout } from "../../../components/OnPointLayout";
import { SafeImage } from "../../../components/SafeImage";
import { LookCard, type LookCardData } from "../../../components/LookCard";
import { LookShareButton } from "./LookShareButton";
import { LookTracker } from "./LookTracker";
import { EditLookButton } from "./EditLookButton";
import { LookItemGrid } from "./LookItemGrid";
import { RUNWAY_THEME_NAMES } from "../../../lib/utils/runway";

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
    { cache: "no-store", signal: AbortSignal.timeout(5000) },
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
      { cache: "no-store", signal: AbortSignal.timeout(5000) },
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

export default async function LookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ sid?: string | string[]; from?: string; judge?: string; theme?: string }>;
}) {
  const { slug } = await params;
  // Share attribution: forward a valid share id through the CTA links so the
  // storefront / agent flows can keep it (docs/ops/growth-loop.md).
  const sp = (await searchParams) || {};
  const rawSid = sp.sid;
  const sidValue = (Array.isArray(rawSid) ? rawSid[0] : rawSid)?.toLowerCase();
  const sidParam = sidValue && /^[a-z0-9]{6,16}$/.test(sidValue) ? `&sid=${sidValue}` : "";
  const look = await loadLook(slug);

  if (!look) notFound();

  const items = look.items || [];
  const heroItem = items.find((i) => i.isHero) || items[0];
  const moreLooks = look.curatorSlug
    ? await loadMoreFromCurator(look.curatorSlug, look.slug)
    : [];
  const runwayBanner =
    sp.from === "runway" && typeof sp.judge === "string"
      ? {
          judge: sp.judge.charAt(0).toUpperCase() + sp.judge.slice(1).toLowerCase(),
          theme: typeof sp.theme === "string" ? RUNWAY_THEME_NAMES[sp.theme] : undefined,
        }
      : null;
  // Humans don't read hex — the wallet is attribution plumbing, not a name.
  const agentShort = "an AI stylist";

  const heroImageSources = [
    look.collageUrl,
    look.coverImageUrl,
    heroItem?.imageUrl,
  ];

  const stats: string[] = [];
  if (look.tryOnCount > 0) stats.push(`${look.tryOnCount} try-ons`);
  if (look.purchaseCount > 0) stats.push(`${look.purchaseCount} purchases`);
  if (look.shareCount > 0) stats.push(`${look.shareCount} shares`);

  const metaTokens = [
    look.metadata?.category,
    look.metadata?.occasion && look.metadata.occasion !== "casual"
      ? look.metadata.occasion.replace("-", " ")
      : null,
    look.metadata?.season && look.metadata.season !== "all-season"
      ? look.metadata.season
      : null,
  ].filter(Boolean) as string[];

  const tryOnHref = heroItem
    ? `/s/${heroItem.curatorSlug}?tryOn=${heroItem.id}&referral=${look.referralCode}&look=${look.slug}${sidParam}`
    : null;

  return (
    <OnPointLayout footer={false}>
      <LookTracker lookSlug={look.slug} />
      <div className="mx-auto max-w-5xl px-4 pb-28 pt-4 md:pb-8 md:pt-8">
        {/* Back link + edit */}
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/?tab=outfits"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            All looks
          </Link>
          <EditLookButton curatorSlug={look.curatorSlug} lookSlug={look.slug} />
        </div>

        {runwayBanner && (
          <div className="mb-4 flex items-center gap-3 border border-primary/30 bg-primary/[0.08] px-4 py-3">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Runway
            </span>
            <p className="text-sm font-bold text-foreground">
              {runwayBanner.judge}&rsquo;s fix{runwayBanner.theme ? ` for ${runwayBanner.theme}` : ""}
              <span className="ml-2 font-normal text-muted-foreground">
                Try it on before your next round.
              </span>
            </p>
          </div>
        )}

        {/* Hero first */}
        <div className="relative aspect-[4/5] overflow-hidden bg-muted md:mx-auto md:max-w-md">
          <SafeImage
            sources={heroImageSources}
            alt={look.title}
            fill
            unoptimized
            className="object-cover"
            fallbackIconSize={64}
          />
        </div>

        {/* Title + quiet meta line, tight under the hero */}
        <div className="mt-4 space-y-2">
          <h1 className="font-display text-3xl leading-[1.05] tracking-[-0.02em] md:text-4xl">
            {look.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            Styled by {agentShort}
            {stats.length > 0 && ` · ${stats.join(" · ")}`}
            {metaTokens.map((t) => (
              <span key={t}>
                {" · "}
                <Link
                  href={`/?tab=outfits&category=${encodeURIComponent(t)}`}
                  className="capitalize underline-offset-2 hover:text-foreground hover:underline"
                >
                  {t}
                </Link>
              </span>
            ))}
            {look.tags.map((tag) => (
              <span key={tag}>
                {" · "}
                <Link
                  href={`/?tab=outfits&tag=${encodeURIComponent(tag)}`}
                  className="capitalize underline-offset-2 hover:text-foreground hover:underline"
                >
                  {tag}
                </Link>
              </span>
            ))}
          </p>
          {look.description && (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {look.description}
            </p>
          )}
          {/* Inline CTA on desktop; mobile gets the sticky bar below */}
          {tryOnHref && (
            <div className="hidden pt-2 md:block">
              <Link
                href={tryOnHref}
                data-look-cta="tryon"
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-8 py-3 text-sm font-bold text-background transition-colors hover:bg-foreground/90"
              >
                <Eye className="h-4 w-4" />
                Try it on
              </Link>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="mt-8">
          <LookItemGrid
            items={items}
            referralCode={look.referralCode}
            lookSlug={look.slug}
            curatorSlug={look.curatorSlug}
          />
        </div>

        {/* More from this curator */}
        {moreLooks.length > 0 && look.curatorSlug && (
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
                More from {look.curatorSlug}
              </h2>
              <Link
                href={`/?tab=outfits&curator=${encodeURIComponent(look.curatorSlug)}`}
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

        {/* Share */}
        <div className="mt-8 flex justify-end border-t border-border pt-6">
          <LookShareButton
            lookSlug={look.slug}
            title={look.title}
            text={look.description || undefined}
            url={look.shareUrl}
          />
        </div>
      </div>

      {/* Sticky try-on — mobile only */}
      {tryOnHref && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
          <Link
            href={tryOnHref}
            data-look-cta="tryon"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3.5 text-sm font-bold text-background transition-colors active:scale-[0.98]"
          >
            <Eye className="h-4 w-4" />
            Try it on
          </Link>
        </div>
      )}
    </OnPointLayout>
  );
}
