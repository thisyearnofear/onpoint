import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import {
  ArrowLeft,
  BarChart3,
  Camera,
  Handshake,
  MapPin,
  MessageCircle,
  PackageSearch,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import type { CuratorStorefrontResponse } from "@onpoint/shared-types";
import { CuratorTracker } from "../../../components/CuratorTracker";
import { ShareStorefront } from "../../../components/ShareStorefront";
import { CrossCuratorRecommendations } from "../../../components/CrossCuratorRecommendations";
import { AICuratorSection } from "../../../components/AICuratorSection";
import { MpesaPaymentPanel } from "./MpesaPaymentPanel";
import { GStreamPanel } from "../../../components/Curator/GStreamPanel";
import { CuratorOwnerTools } from "../../../components/Curator/CuratorOwnerTools";
import { TransitionLink } from "../../../components/ViewTransition";
import { getApiBase } from "../../../lib/utils/api-base";

export const dynamic = "force-dynamic";

type SizeOption = CuratorStorefrontResponse["listings"][number]["sizes"][number];

async function loadStorefront(slug: string): Promise<CuratorStorefrontResponse | null> {
  const res = await fetch(
    `${getApiBase()}/api/curator/${encodeURIComponent(slug)}/storefront`,
    {
      cache: "no-store",
    },
  );

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to load storefront: ${res.status}`);
  }

  return res.json();
}

function formatKitType(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatMoney(value: number) {
  const locale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE || "en-KE";
  const currency = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || "KES";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function getLowestPrice(sizes: SizeOption[]) {
  const prices = sizes
    .map((item) => Number(item.price))
    .filter((price) => Number.isFinite(price) && price > 0);
  return prices.length ? Math.min(...prices) : null;
}

function getTotalStock(sizes: SizeOption[]) {
  return sizes.reduce((total, item) => total + Number(item.stock || 0), 0);
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export const __test = { formatMoney, getLowestPrice, getTotalStock, formatKitType, getInitials };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const storefront = await loadStorefront(slug).catch(() => null);

  if (!storefront) {
    return {
      title: "Curator not found | OnPoint",
    };
  }

  const verticals = storefront.curator.verticals ?? [];
  const verticalLabel = verticals.length > 0
    ? ` · ${verticals.slice(0, 3).join(", ")}`
    : "";
  const listingLabel = storefront.meta.listingCount > 0
    ? `${storefront.meta.listingCount} live listing${storefront.meta.listingCount !== 1 ? "s" : ""}`
    : "Storefront";

  return {
    title: `${storefront.curator.name} | OnPoint`,
    description: `${listingLabel} from ${storefront.curator.name}${verticalLabel}. Try on items with AI, then checkout via WhatsApp.`,
  };
}

export default async function CuratorStorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const storefront = await loadStorefront(slug);

  if (!storefront) {
    notFound();
  }

  const { curator, listings, meta } = storefront;
  const digitalListings = listings.filter((l) => l.digital || l.inventoryType === "digital");
  const physicalListings = listings.filter((l) => !l.digital && l.inventoryType !== "digital");
  const primary = curator.brand?.colors?.primary || "#111827";
  const acc = curator.brand?.colors?.accent || "#e94560";

  // Build listings summary for analytics (slim, no image data)
  const trackerListings = listings.map((l) => ({
    id: l.id,
    club: l.kit?.club || l.title || "Digital",
    kitType: l.kit?.kitType || "design",
    lowestPrice: getLowestPrice(l.sizes),
    checkoutType: meta.checkout,
  }));
  const location = curator.brand?.location;

  return (
    <>
      <CuratorTracker
        slug={slug}
        name={curator.name}
        listingCount={listings.length}
        listings={trackerListings}
      />
      <main
        className="min-h-screen bg-background text-foreground"
        style={
          {
            "--curator-primary": primary,
            "--curator-accent": acc,
          } as CSSProperties
        }
      >
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            OnPoint
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href={`/s/${slug}/intel`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Intelligence
            </Link>
            <ShareStorefront
              curatorSlug={slug}
              curatorName={curator.name}
              whatsappNumber={curator.channels?.whatsapp}
            />
            <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Curator storefront
            </div>
          </div>
        </div>
      </header>

      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1fr_360px] md:py-14">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              {curator.verticals.map((vertical) => (
                <span
                  key={vertical}
                  className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium capitalize text-muted-foreground"
                >
                  {vertical.replaceAll("-", " ")}
                </span>
              ))}
            </div>

            <div className="space-y-4">
              <h1
                className="max-w-3xl text-4xl font-black tracking-tight md:text-6xl"
                style={{ viewTransitionName: `curator-name-${slug}` }}
              >
                {curator.name}
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                Human curation connected to OnPoint try-on. Pick a piece,
                test the fit with AI, then send {curator.name} a ready-to-act
                brief on WhatsApp.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              {location?.city && (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {location.city}
                  {location.landmark ? `, ${location.landmark}` : ""}
                </span>
              )}
              <span className="inline-flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                {meta.listingCount} live listings
              </span>
              {curator.channels?.whatsapp && (
                <span className="inline-flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp checkout
                </span>
              )}
              <span className="inline-flex items-center gap-2">
                <Handshake className="h-4 w-4" />
                Human style handoff
              </span>
            </div>
          </div>

          <aside className="pl-5 border-l-2" style={{ borderColor: "var(--curator-primary)" }}>
            <div className="space-y-4">
              <div
                className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg text-2xl font-black text-white"
                style={{
                  background: "var(--curator-primary)",
                  viewTransitionName: `curator-avatar-${slug}`,
                }}
              >
                {curator.brand?.logo ? (
                  <img
                    src={curator.brand.logo}
                    alt={`${curator.name} logo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  curator.name.slice(0, 1).toUpperCase()
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold">{curator.name}'s role</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  OnPoint reads the look and prepares the brief. {curator.name}
                  confirms the item, size, stock, and styling judgment before
                  the shopper commits.
                </p>
              </div>
              <div className="grid gap-2 text-xs">
                {[
                  "Try on any stocked piece",
                  "Send a fit brief to the curator",
                  "Confirm size, stock, and delivery",
                ].map((step, index) => (
                  <div key={step} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: "var(--curator-primary)" }}
                    >
                      {index + 1}
                    </span>
                    <span className="font-medium">{step}</span>
                  </div>
                ))}
              </div>
              {curator.channels?.whatsapp && (
                <a
                  href={`https://wa.me/${curator.channels.whatsapp.replace(/^\+/, "")}`}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
                  style={{ background: "var(--curator-accent)" }}
                >
                  <MessageCircle className="h-4 w-4" />
                  Message {curator.name}
                </a>
              )}
              {curator.commerce?.walletAddress && (
                <GStreamPanel
                  curatorAddress={curator.commerce.walletAddress}
                  curatorName={curator.name}
                />
              )}
            </div>
          </aside>
        </div>
      </section>

      <section className="border-b border-border bg-muted/20">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 md:grid-cols-[1fr_1fr_1fr]">
          <div className="pl-5 border-l-2 border-primary/20">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <p className="text-xs font-bold uppercase tracking-wider">{curator.name}'s take</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-foreground">
              Start with fit, then let the club color carry the statement. Send me the
              OnPoint brief and I will confirm the cleanest size and available stock.
            </p>
          </div>
          <div className="pl-5 border-l-2 border-primary/20">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Demand loop
            </p>
            <p className="mt-3 text-sm leading-6 text-foreground">
              Every try-on can become a curator lead: selected item, fit profile,
              shopper intent, and the next action.
            </p>
          </div>
          <div className="pl-5 border-l-2 border-primary/20">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Live inventory
            </p>
            <p className="mt-3 text-sm leading-6 text-foreground">
              {meta.listingCount} pieces are ready for AI try-on and WhatsApp confirmation.
              Stock still stays with {curator.name}.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        {/* Curator inventory panel (only visible to the curator themselves) */}
        <CuratorOwnerTools curatorSlug={slug} curatorName={curator.name} />

        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Curator edit
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">
              Try the stock, then ask {curator.name}
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            Each item can start as an AI try-on or go straight to a curator
            message. The human decision stays visible throughout the flow.
          </p>
        </div>
        {listings.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
            <PackageSearch className="h-10 w-10 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-bold">No live listings yet</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              This curator has a storefront, but inventory has not been added
              yet. Check back after the next stock update.
            </p>
            {curator.channels?.whatsapp && (
              <a
                href={`https://wa.me/${curator.channels.whatsapp.replace(/^\+/, "")}?text=${encodeURIComponent(`Hi ${curator.name}, I see your OnPoint storefront is live but has no listings yet. You can add inventory by sending a message like "+ arsenal home M 2500 4" with a photo to the OnPoint agent. Let me know if you need help!`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-600 active:scale-[0.98]"
              >
                <MessageCircle className="h-4 w-4" />
                Message {curator.name} to add stock
              </a>
            )}
          </div>
        ) : (
          <>
          {/* Digital designs — try-on only, no sizes/stock/checkout */}
          {digitalListings.length > 0 && (
            <div className="mb-8">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: "var(--curator-accent)" }} />
                <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Digital Designs · Try-On Only
                </h3>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {digitalListings.map((listing) => (
                  <article
                    key={listing.id}
                    data-listing-id={listing.id}
                    className="overflow-hidden rounded-lg border border-border"
                  >
                    <div className="relative aspect-[4/3] bg-muted">
                      {listing.imageUrl ? (
                        <img
                          src={listing.imageUrl}
                          alt={listing.title || "Digital design"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-white"
                          style={{
                            background:
                              "linear-gradient(135deg, var(--curator-primary), var(--curator-accent))",
                          }}
                        >
                          <Sparkles className="h-10 w-10" />
                          <p className="text-sm font-bold">{listing.title || "Digital Design"}</p>
                        </div>
                      )}
                      <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-violet-600/90 px-3 py-1 text-xs font-bold text-white shadow-sm">
                        <Sparkles className="h-3 w-3" />
                        Digital
                      </div>
                    </div>
                    <div className="space-y-3 p-4">
                      <div>
                        <h2 className="text-lg font-bold">
                          {listing.title || "Digital Design"}
                        </h2>
                        {listing.tags && listing.tags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {listing.tags.slice(0, 5).map((tag) => (
                              <span
                                key={tag}
                                className="rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="rounded-md bg-violet-500/10 px-3 py-2 text-xs text-violet-700 dark:text-violet-300">
                        AI-generated design. Try it on virtually — no physical
                        item to ship. Agents are matched to similar physical
                        items from human curators after try-on.
                      </p>
                      <a
                        href={`/lab?tab=try-on&from=${encodeURIComponent(slug)}&item=${encodeURIComponent(listing.id)}`}
                        data-analytics-tryon
                        data-listing-id={listing.id}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
                        style={{ background: "var(--curator-primary)" }}
                      >
                        <Camera className="h-4 w-4" />
                        Try on this design
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* Physical listings — full commerce flow */}
          {physicalListings.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {physicalListings.map((listing) => {
              const lowestPrice = getLowestPrice(listing.sizes);
              const stock = getTotalStock(listing.sizes);
              const kit = listing.kit;

              return (
                <article
                  key={listing.id}
                  data-listing-id={listing.id}
                  className="overflow-hidden rounded-lg border border-border"
                >
                  <div className="relative aspect-[4/3] bg-muted">
                    {listing.imageUrl ? (
                      <img
                        src={listing.imageUrl}
                        alt={`${kit?.club ?? "Item"} ${kit?.kitType ?? ""} kit`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-white"
                        style={{
                          background:
                            "linear-gradient(135deg, var(--curator-primary), var(--curator-accent))",
                        }}
                      >
                        <div className="grid h-16 w-16 place-items-center rounded-full border border-white/25 bg-white/15 text-xl font-black backdrop-blur">
                          {getInitials(kit?.club ?? "Item")}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{kit?.club ?? "Item"}</p>
                          <p className="text-xs text-white/75">
                            {formatKitType(kit?.kitType ?? "")} kit
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-bold shadow-sm">
                      {formatKitType(kit?.kitType ?? "")}
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    <div>
                      <h2 className="text-lg font-bold">
                        {kit?.club ?? "Item"}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {kit?.season ?? ""} season
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">From</span>
                      <span className="font-bold">
                        {lowestPrice ? formatMoney(lowestPrice) : "Ask"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {listing.sizes.map((size) => (
                        <span
                          key={`${listing.id}-${size.size}`}
                          className="rounded-md border border-border px-2 py-1 text-xs"
                        >
                          {size.size} · {size.stock}
                          {size.printingAvailable ? " · print" : ""}
                        </span>
                      ))}
                    </div>

                    {listing.sizes.some((size) => size.printingAvailable) && (
                      <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                        Plain or printed available. Add name and number in the curator message.
                      </p>
                    )}

                    <MpesaPaymentPanel
                      curatorSlug={curator.slug}
                      curatorName={curator.name}
                      listingId={listing.id}
                      itemName={`${kit?.club ?? "Item"} ${formatKitType(kit?.kitType ?? "")} kit`}
                      sizes={listing.sizes}
                      mpesaNumber={curator.commerce?.mpesaNumber || curator.channels?.whatsapp}
                      checkoutType={curator.commerce?.checkout}
                      checkoutUrl={listing.checkoutUrl}
                    />

                    <div className="flex gap-2">
                      <a
                        href={`/lab?tab=try-on&from=${encodeURIComponent(slug)}&item=${encodeURIComponent(listing.id)}`}
                        data-analytics-tryon
                        data-listing-id={listing.id}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border-2 px-4 py-3 text-sm font-bold transition-all hover:opacity-80 active:scale-[0.98]"
                        style={{ borderColor: "var(--curator-accent)", color: "var(--curator-accent)" }}
                      >
                        <Camera className="h-4 w-4" />
                        Try with AI
                      </a>
                      {listing.checkoutUrl ? (
                        <a
                          href={listing.checkoutUrl}
                          data-analytics-buy
                          data-listing-id={listing.id}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
                          style={{ background: "var(--curator-primary)" }}
                        >
                          Ask {curator.name}
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      ) : (
                        <button
                          disabled
                          className="flex-1 rounded-md bg-muted px-4 py-3 text-sm font-bold text-muted-foreground"
                        >
                          Unavailable
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {stock > 0 ? `${stock} in stock` : "Confirm stock before paying"}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
          )}
          </>
        )}
      </section>

      {/* AI Curator second opinions */}
      {curator.type === "human" && (
        <section className="border-t border-border bg-muted/10">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <AICuratorSection
              curatorName={curator.name}
              curatorSlug={slug}
              verticals={curator.verticals}
              listingId={listings[0]?.id}
            />
          </div>
        </section>
      )}

      {/* Cross-curator AI recommendations */}
      <section className="border-t border-border bg-muted/10">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <CrossCuratorRecommendations sourceCuratorSlug={slug} limit={6} />
        </div>
      </section>

      {/* Browse all curators */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center">
          <TransitionLink
            href="/curators"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Browse all curators
            <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
          </TransitionLink>
        </div>
      </section>
    </main>
    </>
  );
}
