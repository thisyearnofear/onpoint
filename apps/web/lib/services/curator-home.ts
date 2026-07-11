/**
 * Curator home — funnel stats, storefront summary, and WhatsApp brief preview.
 * Single client module for CuratorHomePanel and OnboardingChecklist.
 */

import { getApiBase } from "../utils/api-base";
import type { CuratorStorefrontResponse } from "@onpoint/shared-types";
import {
  fetchWalletStatus,
  type PayoutWalletStatus,
  type WalletStatusResponse,
} from "./curator-payout-wallet";

export interface CuratorFunnelStats {
  pageViews: number;
  tryOns: number;
  shares: number;
  buyClicks: number;
}

export interface ListingBriefPreview {
  id: string;
  label: string;
  size: string;
  priceKes: number;
}

export interface CuratorHomeSnapshot {
  funnel: CuratorFunnelStats;
  listingCount: number;
  agentPurchasable: boolean;
  firstListing: ListingBriefPreview | null;
  wallet: Pick<
    WalletStatusResponse,
    "walletAddress" | "payoutWalletStatus" | "payoutWalletProvider"
  > | null;
}

export async function fetchCuratorFunnel(slug: string): Promise<CuratorFunnelStats> {
  const res = await fetch(
    `/api/curator/analytics/funnel?slug=${encodeURIComponent(slug)}`,
    { cache: "no-store" },
  );
  const data = await res.json().catch(() => ({}));
  return {
    pageViews: Number(data.pageViews) || 0,
    tryOns: Number(data.tryOns) || 0,
    shares: Number(data.shares) || 0,
    buyClicks: Number(data.buyClicks) || 0,
  };
}

function listingLabel(
  listing: CuratorStorefrontResponse["listings"][number],
  curatorName: string,
): string {
  if (listing.kit) {
    return `${listing.kit.club} ${listing.kit.kitType} kit`;
  }
  return listing.title || `item from ${curatorName}`;
}

function firstInStockListing(
  storefront: CuratorStorefrontResponse,
): ListingBriefPreview | null {
  const listing = storefront.listings.find((row) =>
    row.sizes?.some((s) => Number(s.stock) > 0),
  );
  if (!listing) return null;

  const sizeEntry =
    listing.sizes.find((s) => Number(s.stock) > 0) || listing.sizes[0];
  return {
    id: listing.id,
    label: listingLabel(listing, storefront.curator.name),
    size: sizeEntry?.size || "M",
    priceKes: Number(sizeEntry?.price) || 0,
  };
}

export async function fetchCuratorHomeSnapshot(slug: string): Promise<CuratorHomeSnapshot> {
  const apiBase = getApiBase();
  const [funnel, storefrontRes, walletRes] = await Promise.all([
    fetchCuratorFunnel(slug),
    fetch(`/api/curator/${encodeURIComponent(slug)}/storefront`, {
      cache: "no-store",
    }),
    fetchWalletStatus(apiBase, slug).catch(() => null),
  ]);

  let listingCount = 0;
  let agentPurchasable = false;
  let firstListing: ListingBriefPreview | null = null;

  if (storefrontRes.ok) {
    const storefront = (await storefrontRes.json()) as CuratorStorefrontResponse;
    listingCount = storefront.meta?.listingCount ?? storefront.listings?.length ?? 0;
    agentPurchasable = Boolean(
      storefront.meta?.agentCommerce?.enabled
      && storefront.listings?.some((l) => l.agentCommerce?.available),
    );
    firstListing = firstInStockListing(storefront);
  }

  return {
    funnel,
    listingCount,
    agentPurchasable,
    firstListing,
    wallet: walletRes
      ? {
          walletAddress: walletRes.walletAddress,
          payoutWalletStatus: walletRes.payoutWalletStatus,
          payoutWalletProvider: walletRes.payoutWalletProvider,
        }
      : null,
  };
}

/** Plain-language WhatsApp order brief shoppers send after try-on. */
export function buildWhatsAppBriefPreview(params: {
  curatorName: string;
  listing?: ListingBriefPreview | null;
}): string {
  const { curatorName, listing } = params;
  if (!listing) {
    return `Hi ${curatorName}, I tried something on your OnPoint storefront and I'd like to order it — can you confirm size and stock?`;
  }
  const price =
    listing.priceKes > 0
      ? ` — KES ${listing.priceKes.toLocaleString("en-KE")}`
      : "";
  return `Hi ${curatorName}, I'd like to order the ${listing.label} in size ${listing.size}${price}. I already checked the fit on OnPoint.`;
}

export function funnelInsight(stats: CuratorFunnelStats, listingCount: number): string {
  if (stats.buyClicks > 0) {
    return `${stats.buyClicks} shopper${stats.buyClicks === 1 ? "" : "s"} tapped buy — check WhatsApp for ready-to-act briefs.`;
  }
  if (stats.tryOns > 0) {
    return `${stats.tryOns} try-on${stats.tryOns === 1 ? "" : "s"} — fewer "what size?" back-and-forths before they message you.`;
  }
  if (stats.pageViews > 0) {
    return `${stats.pageViews} view${stats.pageViews === 1 ? "" : "s"} so far — share your link to turn browsers into try-ons.`;
  }
  if (listingCount === 0) {
    return "Add your first item, then share your link — this is the message customers will send you.";
  }
  return "Share your storefront — when someone tries on a piece, you get a brief like the one below.";
}

export function agentChannelLabel(
  agentPurchasable: boolean,
  walletStatus: PayoutWalletStatus | undefined,
): { title: string; body: string; tone: "ready" | "setup" | "off" } {
  if (agentPurchasable) {
    return {
      title: "Extra buyers: AI shoppers",
      body: "Your live stock is listed for AI agents worldwide. They pay in cUSD; you fulfil like any WhatsApp order. WhatsApp checkout still works.",
      tone: "ready",
    };
  }
  if (walletStatus === "platform_custodial" || walletStatus === "curator_owned") {
    return {
      title: "Almost ready for AI shoppers",
      body: "Payout wallet is set — add live physical stock with sizes to open agent checkout.",
      tone: "setup",
    };
  }
  return {
    title: "Optional: AI shopper channel",
    body: "Same inventory, extra demand — set a payout wallet when you want AI agents to buy your stock. Not required for WhatsApp sales.",
    tone: "off",
  };
}
