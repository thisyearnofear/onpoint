import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, ExternalLink, ShoppingBag } from "lucide-react";
import { TransitionLink } from "../../../components/ViewTransition";
import { SafeImage } from "../../../components/SafeImage";
import { ArtifactShell } from "../../../components/surface/ArtifactShell";
import { FactList, shortHash, type FactRow } from "../../../components/surface/FactList";
import { MoreRail } from "../../../components/surface/MoreRail";
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
  channels?: { instagram?: string; tiktok?: string; whatsapp?: string };
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
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.receipt ?? null;
  } catch {
    return null;
  }
}

async function loadStorefront(slug: string): Promise<{ curator: Curator | null; listings: Listing[] }> {
  try {
    const res = await fetch(`${getApiBase()}/api/curator/${slug}/storefront`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { curator: null, listings: [] };
    const data = await res.json();
    return { curator: data.curator ?? null, listings: (data.listings ?? []).slice(0, 4) };
  } catch {
    return { curator: null, listings: [] };
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

  const chain = (receipt.chain as string | undefined) || "celo";
  const nearSub =
    (meta.near as { network?: string } | undefined)?.network === "mainnet"
      ? ""
      : "testnet.";
  const explorerFor = (hash?: string) =>
    !hash
      ? null
      : chain === "near"
        ? `https://${nearSub}nearblocks.io/txns/${hash}`
        : `https://celoscan.io/tx/${hash}`;

  const amount = totalCusd ?? priceCusd;

  const { curator, listings } =
    curatorSlug && isPurchase
      ? await loadStorefront(curatorSlug)
      : { curator: null, listings: [] };

  const rows: FactRow[] = [
    ...(item
      ? [{ label: "Item", value: `${item}${size ? ` (${size})` : ""}` }]
      : []),
    ...(amount != null
      ? [{ label: "Amount", value: `${amount} cUSD`, tone: "success" as const }]
      : []),
    ...(curatorPayout
      ? [{ label: "Curator earned", value: curatorPayout, tone: "warning" as const }]
      : []),
    {
      label: "Payout",
      value: splitAddress
        ? "Non-custodial 0xSplits — distributed automatically"
        : curatorSlug
          ? "Custodial payout via OnPoint"
          : "—",
    },
    ...(txHash
      ? [
          {
            label: "Payment proof",
            value: shortHash(txHash),
            href: explorerFor(txHash) ?? undefined,
            mono: true,
          },
        ]
      : []),
    ...(payoutTxHash
      ? [
          {
            label: "Curator payout tx",
            value: shortHash(payoutTxHash),
            href: explorerFor(payoutTxHash) ?? undefined,
            mono: true,
          },
        ]
      : []),
    ...(buyerAddress &&
    buyerAddress !== "0x0000000000000000000000000000000000000000"
      ? [{ label: "Buyer", value: shortHash(buyerAddress), mono: true }]
      : []),
  ];

  return (
    <ArtifactShell
      eyebrow={`Receipt · ${new Date(receipt.timestamp).toLocaleString()}`}
      title={
        isPurchase ? "Order confirmed." : isTryOn ? "Try-on completed." : "Receipt."
      }
      lede={
        curator
          ? `Sold by ${curator.name} — verified on-chain (ERC-8004).`
          : "Verified on-chain (ERC-8004)."
      }
      stickyAction={
        curatorSlug ? (
          <TransitionLink
            href={`/s/${curatorSlug}`}
            className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-full py-4 text-sm font-bold transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            Shop {curator?.name || curatorSlug}
            <ArrowRight className="w-3.5 h-3.5 opacity-60" />
          </TransitionLink>
        ) : undefined
      }
      exits={
        curator && (curator.channels?.instagram || curator.channels?.tiktok) ? (
          <div className="mt-8 flex justify-center gap-4 text-xs text-muted-foreground">
            {curator.channels?.instagram && (
              <a
                href={`https://instagram.com/${curator.channels.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Instagram <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {curator.channels?.tiktok && (
              <a
                href={`https://tiktok.com/@${curator.channels.tiktok}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                TikTok <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ) : undefined
      }
    >
      {curator && (
        <div className="mb-6 mt-6 flex items-center gap-3">
          {curator.avatar ? (
            <div className="relative h-10 w-10 shrink-0">
              <SafeImage
                sources={[curator.avatar]}
                alt={curator.name}
                fill
                unoptimized
                className="rounded-full border border-border object-cover"
              />
            </div>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm font-bold text-foreground">
              {curator.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{curator.name}</p>
            {curator.bio && (
              <p className="truncate text-xs text-muted-foreground">{curator.bio}</p>
            )}
          </div>
        </div>
      )}

      <div className={curator ? "" : "mt-6"}>
        <FactList rows={rows} />
      </div>

      <MoreRail
        items={listings.map((l) => ({
          listingId: l.id,
          curatorSlug: curatorSlug!,
          title: l.title ?? null,
          imageUrl: l.imageUrl ?? null,
        }))}
        title="You might also like"
      />
    </ArtifactShell>
  );
}
