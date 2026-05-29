import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  MessageCircle,
  ShoppingBag,
  Globe,
  Palette,
  Calendar,
  Store,

  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface CuratorDetail {
  slug: string;
  name: string;
  type: string;
  verticals: string[];
  channels: {
    whatsapp?: string;
    telegram?: string;
    instagram?: string;
  };
  brand: {
    logo?: string;
    colors?: {
      primary?: string;
      accent?: string;
    };
    shareCopy?: string;
    location?: {
      city?: string;
      landmark?: string;
    };
  };
  commerce: {
    checkout?: string;
    checkoutUrl?: string;
    whatsappTemplate?: string;
    revShare?: number;
  };
  createdAt: string;
  listingCount: number;
}

async function getCurator(slug: string): Promise<CuratorDetail | null> {
  try {
    const res = await fetch(
      `/api/admin/proxy/curators/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const data = await res.json();
    return data.curator;
  } catch {
    return null;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getStorefrontUrl(slug: string) {
  return `https://onpoint.famile.xyz/s/${slug}`;
}

export default async function CuratorDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const curator = await getCurator(slug);

  if (!curator) {
    notFound();
  }

  const primary = curator.brand?.colors?.primary || "#6366f1";
  const accent = curator.brand?.colors?.accent || "#e94560";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/admin/curators"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Curators
        </Link>
        <span>/</span>
        <span className="text-foreground">{curator.name}</span>
      </div>

      {/* Header card */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="flex h-2" style={{ background: `linear-gradient(90deg, ${primary}, ${accent})` }} />        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 max-w-full">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-black text-white shadow-lg"
                style={{ background: primary }}
              >
                {curator.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight truncate">{curator.name}</h1>
                <p className="text-sm text-muted-foreground">@{curator.slug}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {curator.verticals?.map((v) => (
                    <span
                      key={v}
                      className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                    >
                      {v.replaceAll("-", " ")}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex w-full sm:w-auto gap-2">
              <a
                href={getStorefrontUrl(curator.slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                <Store className="h-4 w-4" />
                Storefront
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <Link
                href={`/admin/curators/${curator.slug}/listings`}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                <ShoppingBag className="h-4 w-4" />
                Listings
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <ShoppingBag className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-black">{curator.listingCount}</p>
              <p className="text-xs text-muted-foreground">Listings</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{formatDate(curator.createdAt)}</p>
              <p className="text-xs text-muted-foreground">Joined</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
              {curator.channels?.whatsapp ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">
                {curator.channels?.whatsapp ? "WhatsApp connected" : "No WhatsApp"}
              </p>
              <p className="text-xs text-muted-foreground">
                {curator.channels?.whatsapp || "Checkout method: " + (curator.commerce?.checkout || "whatsapp")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Details sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Channels */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-bold">
            <MessageCircle className="h-4 w-4 text-emerald-500" />
            Channels
          </h2>
          <div className="mt-4 space-y-3 text-sm">
            {curator.channels?.whatsapp ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">WhatsApp</span>
                <a
                  href={`https://wa.me/${curator.channels.whatsapp.replace(/^\+/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-emerald-600 hover:text-emerald-500"
                >
                  {curator.channels.whatsapp}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ) : (
              <p className="text-muted-foreground italic">No channels configured</p>
            )}
            {curator.channels?.telegram && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Telegram</span>
                <span>{curator.channels.telegram}</span>
              </div>
            )}
            {curator.channels?.instagram && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Instagram</span>
                <span>{curator.channels.instagram}</span>
              </div>
            )}
          </div>
        </div>

        {/* Commerce */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-bold">
            <ShoppingBag className="h-4 w-4 text-primary" />
            Commerce
          </h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Checkout method</span>
              <span className="font-medium capitalize">
                {curator.commerce?.checkout || "whatsapp"}
              </span>
            </div>
            {curator.commerce?.revShare !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Revenue share</span>
                <span className="font-medium">
                  {(curator.commerce.revShare * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Brand */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-bold">
            <Palette className="h-4 w-4 text-violet-500" />
            Brand
          </h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-muted-foreground shrink-0">Primary</span>
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="h-5 w-5 shrink-0 rounded-md border border-border"
                  style={{ background: primary }}
                />
                <code className="truncate max-w-[140px] rounded bg-muted px-2 py-0.5 text-xs font-mono">
                  {primary}
                </code>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-muted-foreground shrink-0">Accent</span>
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="h-5 w-5 shrink-0 rounded-md border border-border"
                  style={{ background: accent }}
                />
                <code className="truncate max-w-[140px] rounded bg-muted px-2 py-0.5 text-xs font-mono">
                  {accent}
                </code>
              </div>
            </div>
            {curator.brand?.location?.city && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium">
                  {curator.brand.location.city}
                  {curator.brand.location.landmark
                    ? `, ${curator.brand.location.landmark}`
                    : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Storefront link */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-bold">
            <Globe className="h-4 w-4 text-sky-500" />
            Storefront
          </h2>
          <div className="mt-4 space-y-3">
            <a
              href={getStorefrontUrl(curator.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm font-mono text-primary transition-colors hover:bg-muted"
            >
              {getStorefrontUrl(curator.slug)}
            </a>
            <p className="text-xs text-muted-foreground">
              Share this link with customers. They get try-on, polaroid, and
              WhatsApp checkout — no app needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
