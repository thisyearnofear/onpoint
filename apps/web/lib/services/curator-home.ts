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
    "walletAddress" | "payoutWalletStatus" | "payoutWalletProvider" | "activatedAt"
  > | null;
  nudge: {
    activeStorefronts: number;
    betaSpotsRemaining: number;
  };
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
  const [funnel, storefrontRes, walletRes, dirRes] = await Promise.all([
    fetchCuratorFunnel(slug),
    fetch(`/api/curator/${encodeURIComponent(slug)}/storefront`, {
      cache: "no-store",
    }),
    fetchWalletStatus(apiBase, slug).catch(() => null),
    fetch(`${apiBase}/api/curator/directory`, { cache: "no-store" }).catch(() => null),
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

  let dirMeta: { activeStorefronts?: number; betaSpotsRemaining?: number } = {};
  if (dirRes?.ok) {
    const dirData = await dirRes.json().catch(() => ({}));
    dirMeta = {
      activeStorefronts: dirData.meta?.activeStorefronts ?? 0,
      betaSpotsRemaining: dirData.meta?.betaSpotsRemaining ?? 0,
    };
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
          activatedAt: walletRes.activatedAt,
        }
      : null,
    nudge: {
      activeStorefronts: dirMeta.activeStorefronts ?? 0,
      betaSpotsRemaining: dirMeta.betaSpotsRemaining ?? 0,
    },
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
      title: "AI shoppers are live on your storefront",
      body: "Your stock is listed for AI agents worldwide. They pay in cUSD on Celo; you fulfil like any WhatsApp order. You're ahead of curators still setting up.",
      tone: "ready",
    };
  }
  if (walletStatus === "platform_custodial" || walletStatus === "curator_owned") {
    return {
      title: "Almost ready — one step from AI revenue",
      body: "Your payout wallet is set. Add live physical stock with sizes to unlock agent checkout. Every day without stock is a day AI shoppers buy elsewhere.",
      tone: "setup",
    };
  }
  return {
    title: "Your storefront is invisible to AI shoppers",
    body: "AI agents are buying from curators with active wallets right now. You're missing that demand. Add a payout wallet (60 seconds, free) to go live.",
    tone: "off",
  };
}

/**
 * Nudge psychology for the curator dashboard. Creates urgency and FOMO
 * without being pushy — shows what they're missing, limited beta scarcity,
 * and social proof from active curators.
 */
export function nudgeInsight(params: {
  agentPurchasable: boolean;
  walletStatus: PayoutWalletStatus | undefined;
  activatedAt?: string | null;
  activeStorefronts?: number;
  betaSpotsRemaining?: number;
  tryOns: number;
}): { headline: string; detail: string; cta: string; urgency: "high" | "medium" | "none" } {
  const { agentPurchasable, walletStatus, activatedAt, activeStorefronts = 0, betaSpotsRemaining, tryOns } = params;

  if (agentPurchasable) {
    // Already live — celebrate and show momentum
    return {
      headline: tryOns > 0
        ? `${tryOns} try-on${tryOns === 1 ? "" : "s"} on your stock`
        : "You're live for AI shoppers",
      detail: tryOns > 0
        ? "AI agents are discovering your items. Keep stock fresh to stay ranked in the directory."
        : "Your storefront is agent-ready. New items boost your directory ranking.",
      cta: "Add more stock",
      urgency: "none",
    };
  }

  // Has wallet but not activated yet
  if ((walletStatus === "platform_custodial" || walletStatus === "curator_owned") && !activatedAt) {
    return {
      headline: "Your storefront is invisible to AI shoppers",
      detail: `You have a payout wallet, but you haven't activated yet. ${activeStorefronts} curator${activeStorefronts === 1 ? "" : "s"} are live and getting AI orders. Activate now to join them.`,
      cta: "Activate storefront",
      urgency: "high",
    };
  }

  if (walletStatus === "platform_custodial" || walletStatus === "curator_owned") {
    return {
      headline: "Wallet ready — stock is the last step",
      detail: "Other curators with live stock are getting AI orders. Add one item with sizes to join them.",
      cta: "Add your first item",
      urgency: "medium",
    };
  }

  // No wallet at all — maximum nudge
  const betaText = betaSpotsRemaining !== undefined && betaSpotsRemaining <= 10
    ? ` Only ${betaSpotsRemaining} beta spots left.`
    : "";
  return {
    headline: `${activeStorefronts} curator${activeStorefronts === 1 ? "" : "s"} are live for AI shoppers`,
    detail: `AI agents browse the directory and buy from activated curators. You're not visible to them yet.${betaText} It takes 60 seconds to activate.`,
    cta: "Activate payout wallet",
    urgency: "high",
  };
}
