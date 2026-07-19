import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  ShoppingBag,
  Star,
} from "lucide-react";
import { OnPointLayout } from "../../../components/OnPointLayout";
import { TransitionLink } from "../../../components/ViewTransition";
import { SafeImage } from "../../../components/SafeImage";
import { getApiBase } from "../../../lib/utils/api-base";

export const dynamic = "force-dynamic";

interface Receipt {
  id: string;
  agentId: number;
  agentAddress: string;
  action: string;
  sessionId: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  txHash?: string;
  chain?: string;
}

interface Curator {
  slug: string;
  name: string;
  bio?: string;
  avatar?: string;
  bannerImage?: string;
  channels?: {
    instagram?: string;
    tiktok?: string;
    whatsapp?: string;
  };
}

interface Listing {
  id: string;
  title?: string;
  imageUrl?: string;
  sizes?: Array<{ size: string; price: number; stock: number }>;
}

async function loadReceipt(id: string): Promise<Receipt | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/receipts/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.receipt ?? null;
  } catch {
    return null;
  }
}

async function loadCurator(slug: string): Promise<Curator | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/curator/${slug}/storefront`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.curator ?? null;
  } catch {
    return null;
  }
}

async function loadCuratorListings(slug: string): Promise<Listing[]> {
  try {
    const res = await fetch(`${getApiBase()}/api/curator/${slug}/storefront`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.listings ?? []).slice(0, 4);
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ receiptId: string }>;
}): Promise<Metadata> {
  const { receiptId } = await params;
  const receipt = await loadReceipt(receiptId);
  if (!receipt) return { title: "OnPoint — Receipt" };

  const action = receipt.action;
  const isPurchase = action === "purchase";
  const title = isPurchase
    ? "OnPoint Order Confirmed"
    : action === "analyze_outfit"
      ? "OnPoint Try-On Receipt"
      : `OnPoint — ${action}`;

  return {
    title,
    description: `Verifiable on-chain receipt for an OnPoint ${action} transaction on Celo.`,
    openGraph: {
      title,
      description: `Verifiable on-chain receipt for an OnPoint ${action} transaction on Celo.`,
    },
  };
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ receiptId: string }>;
}) {
  const { receiptId } = await params;
  const receipt = await loadReceipt(receiptId);
  if (!receipt) notFound();

  const meta = receipt.metadata;
  const isPurchase = receipt.action === "purchase";
  const isTryOn = receipt.action === "analyze_outfit";

  const txHash = (meta.txHash || receipt.txHash) as string | undefined;
  const payoutTxHash = meta.payoutTxHash as string | undefined;
  const curatorSlug = meta.curatorSlug as string | undefined;
  const item = meta.item as string | undefined;
  const totalCusd = meta.totalCusd as number | undefined;
  const curatorPayout = meta.curatorPayout as string | undefined;
  const size = meta.size as string | undefined;
  const buyerAddress = meta.buyerAddress as string | undefined;
  const splitAddress = meta.splitAddress as string | undefined;
  const priceCusd = meta.priceCusd as number | undefined;

  const explorerUrl = txHash
    ? `https://celoscan.io/tx/${txHash}`
    : null;
  const payoutExplorerUrl = payoutTxHash
    ? `https://celoscan.io/tx/${payoutTxHash}`
    : null;

  const amount = totalCusd ?? priceCusd;

  // Load curator data and recommendations for purchase receipts
  const [curator, recommendations] = curatorSlug && isPurchase
    ? await Promise.all([
        loadCurator(curatorSlug),
        loadCuratorListings(curatorSlug),
      ])
    : [null, []];

  return (
    <OnPointLayout className="flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-3xl overflow-hidden shadow-2xl border border-border">
            {/* Header — success gradient */}
            <div className="relative bg-gradient-to-br from-emerald-600/90 to-teal-700/90 p-8 pb-10 overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 blur-3xl rounded-full" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-white/80" />
                    <span className="text-sm font-black text-white tracking-tight italic">
                      OnPoint
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
                    Receipt
                  </span>
                </div>
                <div className="flex flex-col items-center text-center">
                  <CheckCircle2 className="w-12 h-12 text-white/90 mb-3" />
                  <h1 className="text-xl font-bold text-white">
                    {isPurchase ? "Order Confirmed" : isTryOn ? "Try-On Completed" : "Receipt"}
                  </h1>
                  <p className="text-sm text-white/60 mt-1">
                    {new Date(receipt.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Item */}
              {item && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                  <span className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-bold">
                    Item
                  </span>
                  <span className="text-sm text-foreground font-medium text-right">
                    {item}
                    {size ? ` (${size})` : ""}
                  </span>
                </div>
              )}

              {/* Amount paid */}
              {amount != null && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                  <span className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-bold">
                    Amount
                  </span>
                  <span className="text-lg font-bold text-emerald-400">
                    {amount} cUSD
                  </span>
                </div>
              )}

              {/* Curator payout */}
              {curatorPayout && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                  <span className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-bold">
                    Curator Earned
                  </span>
                  <span className="text-sm text-amber-400 font-medium">
                    {curatorPayout}
                  </span>
                </div>
              )}

              {/* Payout model */}
              {splitAddress ? (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                  <span className="text-xs text-indigo-300">
                    Non-custodial 0xSplits payout — funds distributed automatically
                  </span>
                </div>
              ) : curatorSlug ? (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/50">
                  <div className="w-2 h-2 rounded-full bg-success shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    Curator paid directly via OnPoint custodial payout
                  </span>
                </div>
              ) : null}

              {/* On-chain proof */}
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50 hover:border-primary/30 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success shrink-0" />
                    <span className="text-xs text-muted-foreground">
                      Payment proof
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-primary font-medium font-mono">
                      {txHash!.slice(0, 8)}...{txHash!.slice(-6)}
                    </span>
                    <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
                  </div>
                </a>
              )}

              {/* Payout proof */}
              {payoutExplorerUrl && (
                <a
                  href={payoutExplorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50 hover:border-primary/30 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-warning shrink-0" />
                    <span className="text-xs text-muted-foreground">
                      Curator payout
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-primary font-medium font-mono">
                      {payoutTxHash!.slice(0, 8)}...{payoutTxHash!.slice(-6)}
                    </span>
                    <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
                  </div>
                </a>
              )}

              {/* Buyer address */}
              {buyerAddress && buyerAddress !== "0x0000000000000000000000000000000000000000" && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                  <span className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-bold">
                    Buyer
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {buyerAddress.slice(0, 8)}...{buyerAddress.slice(-6)}
                  </span>
                </div>
              )}

              {/* Curator branding */}
              {curator && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    {curator.avatar ? (
                      <div className="relative w-12 h-12">
                        <SafeImage
                          sources={[curator.avatar]}
                          alt={curator.name}
                          fill
                          unoptimized
                          className="rounded-full border-2 border-indigo-500/30 object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                        {curator.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-foreground">{curator.name}</h3>
                      {curator.bio && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {curator.bio}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {curator.channels?.instagram && (
                      <a
                        href={`https://instagram.com/${curator.channels.instagram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium transition-colors"
                      >
                        <Star className="w-3 h-3" />
                        Instagram
                      </a>
                    )}
                    {curator.channels?.tiktok && (
                      <a
                        href={`https://tiktok.com/@${curator.channels.tiktok}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium transition-colors"
                      >
                        <Star className="w-3 h-3" />
                        TikTok
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Product recommendations */}
              {recommendations.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">
                    You might also like
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {recommendations.map((listing) => (
                      <TransitionLink
                        key={listing.id}
                        href={`/s/${curatorSlug}`}
                        className="group relative rounded-xl overflow-hidden border border-border/50 hover:border-primary/30 transition-all"
                      >
                        {listing.imageUrl ? (
                          <div className="relative aspect-square bg-muted">
                            <SafeImage
                              sources={[listing.imageUrl]}
                              alt={listing.title || "Product"}
                              fill
                              unoptimized
                              className="object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>
                        ) : (
                          <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                            <ShoppingBag className="w-8 h-8 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <p className="text-xs font-medium text-white line-clamp-1">
                            {listing.title || "View product"}
                          </p>
                        </div>
                      </TransitionLink>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA — shop the curator */}
              {curatorSlug && (
                <TransitionLink
                  href={`/s/${curatorSlug}`}
                  className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-full py-4 text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Shop {curator?.name || curatorSlug}
                  <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                </TransitionLink>
              )}
            </div>
          </div>

          {/* Footer hint */}
          <p className="text-center text-xs text-muted-foreground/50 mt-4">
            Verifiable on-chain receipt powered by OnPoint (ERC-8004)
          </p>
        </div>
      </div>
    </OnPointLayout>
  );
}
