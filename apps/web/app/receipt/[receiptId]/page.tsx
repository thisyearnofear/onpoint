import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, ExternalLink, ShoppingBag } from "lucide-react";
import { TransitionLink } from "../../../components/ViewTransition";
import { SafeImage } from "../../../components/SafeImage";
import { ArtifactShell } from "../../../components/surface/ArtifactShell";
import { FactList } from "../../../components/surface/FactList";
import { ArtifactImage } from "../../../components/surface/ArtifactImage";
import { MoreRail } from "../../../components/surface/MoreRail";
import { SourceBadge } from "../../../components/surface/SourceBadge";
import { ShareArtifact } from "../../../components/ShareArtifact";
import { AgentTrace } from "../../../components/pay/AgentTrace";
import { getApiBase } from "../../../lib/utils/api-base";
import { loadPolaroid } from "../../../lib/pay/polaroid";
import { buildReceiptView, railFromReceipt, sourceKind } from "../../../lib/pay/rails";

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
  signature?: string;
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
  cutoutUrl?: string;
  inventoryType?: string;
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
    return { curator: data.curator ?? null, listings: data.listings ?? [] };
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
  const rail = railFromReceipt(receipt);
  const title = isPurchase
    ? "OnPoint Order Confirmed"
    : action === "analyze_outfit"
      ? "OnPoint Try-On Receipt"
      : `OnPoint — ${action}`;
  const description = `Verifiable receipt for an OnPoint ${isPurchase ? "order" : "try-on"}, paid ${
    rail === "paypal" ? "through PayPal" : rail === "near" ? "on NEAR" : "on Celo"
  }.`;

  return {
    title,
    description,
    openGraph: { title, description },
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
  const isTryOn = receipt.action === "analyze_outfit" || meta.purpose === "try_on";
  const curatorSlug = meta.curatorSlug as string | undefined;
  const listingId = meta.listingId as string | undefined;
  const item = meta.item as string | undefined;

  const { curator, listings } = curatorSlug
    ? await loadStorefront(curatorSlug)
    : { curator: null, listings: [] };

  const boughtListing = listings.find((l) => l.id === listingId);
  const kind = sourceKind({
    curatorSlug: curatorSlug ?? "",
    inventoryType: boughtListing?.inventoryType,
  });

  // Try-on receipts point at the polaroid via sessionId "tryon_{paymentId}".
  const paymentId = isTryOn && receipt.sessionId?.startsWith("tryon_")
    ? receipt.sessionId.slice("tryon_".length)
    : null;
  const polaroid = paymentId ? await loadPolaroid(paymentId) : null;

  const view = buildReceiptView(receipt, curator?.name ?? undefined);
  // Purchase shots try the cutout first but cutouts can be dead R2 keys —
  // SafeImage falls through to the photo, and the frame drops entirely if
  // every candidate fails.
  const artifactImage = isTryOn ? polaroid?.imageUrl : null;
  const purchaseSources = isTryOn
    ? []
    : [boughtListing?.cutoutUrl, boughtListing?.imageUrl];

  const moreItems = listings
    .filter((l) => l.id !== listingId)
    .map((l) => ({
      listingId: l.id,
      curatorSlug: curatorSlug!,
      title: l.title ?? null,
      imageUrl: l.imageUrl ?? null,
    }));

  const stickyAction = isPurchase ? (
    curatorSlug ? (
      <TransitionLink
        href={`/s/${curatorSlug}`}
        className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-full py-4 text-sm font-bold transition-colors"
      >
        {kind !== "ai-designer" ? <ShoppingBag className="w-4 h-4" /> : null}
        {kind === "ai-designer" ? `See more from ${curator?.name || curatorSlug}` : `More from ${curator?.name || curatorSlug}`}
        <ArrowRight className="w-3.5 h-3.5 opacity-60" />
      </TransitionLink>
    ) : undefined
  ) : paymentId ? (
    <TransitionLink
      href={`/p/${paymentId}`}
      className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-full py-4 text-sm font-bold transition-colors"
    >
      See the try-on
      <ArrowRight className="w-3.5 h-3.5 opacity-60" />
    </TransitionLink>
  ) : curatorSlug && kind === "ai-designer" ? (
    <TransitionLink
      href={`/s/${curatorSlug}`}
      className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-full py-4 text-sm font-bold transition-colors"
    >
      See more from {curator?.name || curatorSlug}
      <ArrowRight className="w-3.5 h-3.5 opacity-60" />
    </TransitionLink>
  ) : undefined;

  return (
    <ArtifactShell
      eyebrow={`Receipt · ${new Date(receipt.timestamp).toLocaleString()}`}
      artifact={
        artifactImage || purchaseSources.some(Boolean) ? (
          isTryOn ? (
            <TransitionLink href={paymentId ? `/p/${paymentId}` : "#"} className="block">
              <div className="relative aspect-[3/4] border border-border bg-muted/20">
                <SafeImage
                  sources={[artifactImage]}
                  alt={item ? `${item} — AI try-on` : "Try-on render"}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 600px"
                  className="object-cover"
                />
              </div>
            </TransitionLink>
          ) : (
            <ArtifactImage
              sources={purchaseSources}
              alt={item ?? "Ordered item"}
              aspect="aspect-[4/3]"
              imageClassName="object-contain"
            />
          )
        ) : undefined
      }
      title={
        isPurchase ? "Order confirmed." : isTryOn ? "Try-on completed." : "Receipt."
      }
      lede={view.lede}
      stickyAction={stickyAction}
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
          <span className="ml-auto shrink-0"><SourceBadge kind={kind} /></span>
        </div>
      )}

      <div className={curator ? "" : "mt-6"}>
        <AgentTrace steps={view.steps} verdict={view.verdict} title="What I did" />
      </div>

      <div className="mt-6">
        <FactList rows={view.rows} />
      </div>

      <div className="mt-6">
        <ShareArtifact
          title="OnPoint receipt"
          text={item ? `Receipt for ${item} on OnPoint.` : "A verifiable OnPoint receipt."}
          url={`/receipt/${receipt.id}`}
          imageUrl={artifactImage ?? boughtListing?.imageUrl ?? null}
        />
      </div>

      {moreItems.length > 0 && curator ? (
        <MoreRail items={moreItems} title={`More from ${curator.name}`} />
      ) : null}
    </ArtifactShell>
  );
}
