import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import {
  ArrowLeft,
  Eye,
  Share2,
  Shirt,
  Sparkles,
  TrendingUp,
  User,
} from "lucide-react";
import { getApiBase } from "../../../lib/utils/api-base";
import { OnPointLayout } from "../../../components/OnPointLayout";

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
  tags: string[];
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

  return {
    title: `${look.title} | OnPoint Looks`,
    description: look.description || `A styled look by ${look.agentAddress ? look.agentAddress.slice(0, 8) + "…" : "an agent"} on OnPoint`,
    openGraph: {
      images: look.coverImageUrl ? [look.coverImageUrl] : (look.items || []).find((i) => i.imageUrl)?.imageUrl ? [(look.items || []).find((i) => i.imageUrl)!.imageUrl!] : [],
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
  const otherItems = items.filter((i) => !i.isHero);
  const agentShort = look.agentAddress
    ? `${look.agentAddress.slice(0, 6)}…${look.agentAddress.slice(-4)}`
    : "unknown";

  return (
    <OnPointLayout footer={false}>
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Look header */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {look.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium capitalize text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>

          <h1 className="text-3xl font-black tracking-tight md:text-5xl">
            {look.title}
          </h1>

          {look.description && (
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              {look.description}
            </p>
          )}

          {/* Agent attribution */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <User className="h-4 w-4" />
              Styled by{" "}
              <span className="font-mono font-medium text-foreground">
                {agentShort}
              </span>
            </span>
            <span className="inline-flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {look.tryOnCount} try-ons
            </span>
            <span className="inline-flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {look.purchaseCount} purchases
            </span>
            <span className="inline-flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              {look.shareCount} shares
            </span>
          </div>
        </div>

        {/* Hero + items grid */}
        <div className="grid gap-6 md:grid-cols-[1fr_360px]">
          {/* Hero image / try-on CTA */}
          <div className="space-y-4">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-border bg-muted">
              {look.coverImageUrl ? (
                <Image
                  src={look.coverImageUrl}
                  alt={look.title}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : heroItem?.imageUrl ? (
                <Image
                  src={heroItem.imageUrl}
                  alt={heroItem.title}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Shirt className="h-16 w-16 text-muted-foreground/30" />
                </div>
              )}

              {/* Agent watermark */}
              <div className="absolute bottom-3 left-3 rounded-full bg-background/80 px-3 py-1 text-xs font-medium backdrop-blur">
                Styled by {agentShort}
              </div>
            </div>

            {/* Try-on CTA */}
            <div className="rounded-xl border border-border bg-muted/50 p-4">
              <h3 className="mb-2 font-bold">Try on this look</h3>
              <p className="mb-3 text-sm text-muted-foreground">
                Upload a photo and see how the hero piece ({heroItem?.title}) looks on you.
                Get a shareable collage card for Instagram.
              </p>
              <Link
                href={`/s/${heroItem?.curatorSlug}?tryOn=${heroItem?.id}&referral=${look.referralCode}&look=${look.slug}`}
                className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-bold text-background transition-colors hover:bg-foreground/90"
              >
                <Eye className="h-4 w-4" />
                Try on {heroItem?.title}
              </Link>
            </div>
          </div>

          {/* Items list */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              The Look ({items.length} pieces)
            </h2>

            {items.map((item) => {
              const price = getLowestPrice(item.sizes);
              return (
                <Link
                  key={item.id}
                  href={`/s/${item.curatorSlug}?referral=${look.referralCode}&look=${look.slug}#${item.id}`}
                  className="block rounded-xl border border-border p-3 transition-colors hover:border-foreground/20 hover:bg-muted/50"
                >
                  <div className="flex gap-3">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.title}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Shirt className="h-6 w-6 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold leading-tight">
                          {item.title}
                        </h3>
                        {item.isHero && (
                          <span className="shrink-0 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold uppercase text-background">
                            Hero
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        by{" "}
                        <span className="capitalize">{item.curatorSlug}</span>
                        {item.kit?.brand && ` · ${item.kit.brand}`}
                      </p>
                      {price && (
                        <p className="text-sm font-bold text-foreground">
                          KES {price.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}

            {/* Share buttons */}
            <div className="space-y-2 pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Share this look
              </h3>
              <div className="flex gap-2">
                <button
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: look.title,
                        url: look.shareUrl,
                      });
                    } else {
                      navigator.clipboard.writeText(look.shareUrl);
                    }
                  }}
                >
                  Copy link
                </button>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(look.title)}&url=${encodeURIComponent(look.shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-center text-xs font-medium transition-colors hover:bg-muted"
                >
                  Tweet
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </OnPointLayout>
  );
}
