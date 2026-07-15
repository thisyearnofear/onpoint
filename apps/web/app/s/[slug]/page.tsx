/* eslint-disable @next/next/no-img-element -- Curator inventory permits arbitrary remote image sources. */

import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import {
  ArrowLeft,
  Camera,
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
import { CuratorOwnerTools } from "../../../components/Curator/CuratorOwnerTools";
import { TransitionLink } from "../../../components/ViewTransition";
import { getApiBase } from "../../../lib/utils/api-base";
import {
  formatKitType,
  formatMoney,
  getInitials,
  getLowestPrice,
  getTotalStock,
} from "./storefront-helpers";

export const dynamic = "force-dynamic";

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

function getViewTransitionName(prefix: string, value: string) {
  const safeValue = value.replace(/[^a-zA-Z0-9_-]/g, "-");
  return `${prefix}-${safeValue || "item"}`;
}

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

  // Human curators with platform-provisioned wallets haven't been onboarded yet —
  // show a "Preview" badge so visitors know the curator hasn't claimed their storefront.
  const isPreview =
    curator.type !== "ai" &&
    curator.commerce?.payoutWalletStatus === "platform_custodial";

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
                data-view-transition="curator-name"
                style={{ viewTransitionName: `curator-name-${slug}` }}
              >
                {curator.name}
                {isPreview && (
                  <span className="ml-3 inline-flex items-center gap-1.5 align-middle rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    <Sparkles className="h-3 w-3" />
                    Preview
                  </span>
                )}
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                {isPreview
                  ? `A preview of ${curator.name}'s catalog — real stock and pricing, with AI try-on. This curator is in the process of joining OnPoint.`
                  : `Real stock, fit-aware decisions, and a direct line to ${curator.name}. Choose a piece, try it on with AI, then confirm the details on WhatsApp.`}
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
            </div>
          </div>

          <aside className="border-l-2 pl-5" style={{ borderColor: "var(--curator-primary)" }}>
            <div className="space-y-5">
              <div
                className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg text-2xl font-black text-white"
                data-view-transition="curator-avatar"
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
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">How it works</p>
                <h2 className="mt-2 text-lg font-bold">Fit first. Confirm with {curator.name}.</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  OnPoint prepares the fit context; the curator confirms availability,
                  size, and delivery before you pay.
                </p>
              </div>
              <div className="grid gap-2 text-xs">
                {[
                  "Choose from the live collection",
                  "Try on a piece with AI",
                  "Confirm size and delivery",
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
                  Chat with {curator.name}
                </a>
              )}
            </div>
          </aside>
        </div>
      </section>

      <section id="collection" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10">
        {/* Curator inventory panel (only visible to the curator themselves) */}
        <CuratorOwnerTools curatorSlug={slug} curatorName={curator.name} />

        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Available now
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">
              Choose a piece, then decide with confidence
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            Every listing shows its live sizes and price. Try it on first, or ask the
            curator to confirm availability directly.
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
                    data-view-transition="product-card"
                    style={{ viewTransitionName: getViewTransitionName("product-card", listing.id) }}
                    className="overflow-hidden rounded-lg border border-border"
                  >
                    <div
                      className="relative aspect-[4/3] bg-muted"
                      data-view-transition="product-image"
                      style={{ viewTransitionName: getViewTransitionName("product-image", listing.id) }}
                    >
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
                        <h2
                          className="text-lg font-bold"
                          data-view-transition="product-title"
                          style={{ viewTransitionName: getViewTransitionName("product-title", listing.id) }}
                        >
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
                  data-view-transition="product-card"
                  style={{ viewTransitionName: getViewTransitionName("product-card", listing.id) }}
                  className="overflow-hidden rounded-lg border border-border"
                >
                  <div
                    className="relative aspect-[4/3] bg-muted"
                    data-view-transition="product-image"
                    style={{ viewTransitionName: getViewTransitionName("product-image", listing.id) }}
                  >
                    {listing.imageUrl ? (
                      <img
                        src={listing.imageUrl}
                        alt={`${kit?.club ?? "Item"} ${kit?.kitType ?? ""} kit`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-3 bg-muted/60 p-6 text-center">
                        <div className="grid h-16 w-16 place-items-center rounded-full border border-border bg-background text-xl font-black text-muted-foreground">
                          {getInitials(kit?.club ?? "Item")}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">Curator photo pending</p>
                          <p className="mt-1 text-xs text-muted-foreground">Availability and price are live.</p>
                        </div>
                      </div>
                    )}
                    <div className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-bold shadow-sm">
                      {formatKitType(kit?.kitType ?? "")}
                    </div>
                    {isPreview && listing.imageUrl && (
                      <div className="absolute bottom-3 right-3 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur">
                        Concept image
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 p-4">
                    <div>
                      <h2
                        className="text-lg font-bold"
                        data-view-transition="product-title"
                        style={{ viewTransitionName: getViewTransitionName("product-title", listing.id) }}
                      >
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
