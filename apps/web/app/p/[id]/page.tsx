import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { TransitionLink } from "../../../components/ViewTransition";
import { SafeImage } from "../../../components/SafeImage";
import { ArtifactShell } from "../../../components/surface/ArtifactShell";
import { FactList, shortHash } from "../../../components/surface/FactList";
import { SourceBadge } from "../../../components/surface/SourceBadge";
import { ShareArtifact } from "../../../components/ShareArtifact";
import { ReactionBar } from "../../../components/social/ReactionBar";
import { TryOnActionRail } from "../../../components/social/TryOnActionRail";
import { FirstBadge } from "../../../components/social/FirstBadge";
import { PolaroidGetItLink } from "./PolaroidGetItLink";
import { PolaroidTracker } from "./PolaroidTracker";
import { loadPolaroid } from "../../../lib/pay/polaroid";
import { fitVerdict, railFromPolaroidPayment, sourceKind } from "../../../lib/pay/rails";

export const dynamic = "force-dynamic";

/** Which gateway served the inference, spelled for the receipt line. */
function gatewayLabel(provider: string): string {
  const known: Record<string, string> = {
    otari: "Otari",
    sandbase: "Sandbase",
  };
  return known[provider] ?? provider;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const meta = await loadPolaroid(id);
  if (!meta) {
    return { title: "OnPoint — Try-On Result" };
  }
  const scoreText = meta.fitSignal?.score
    ? `Style Score: ${meta.fitSignal.score}/10`
    : "";
  const title = `${meta.item} — OnPoint AI Try-On`;
  const tail =
    meta.inventoryType === "digital"
      ? "A digital design, tried on."
      : "See the fit, then shop the real thing on OnPoint.";
  const description = `AI try-on for ${meta.item} by ${meta.curatorName}.${scoreText ? ` ${scoreText}.` : ""} ${tail}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: meta.imageUrl, width: 1024, height: 1024 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [meta.imageUrl],
    },
  };
}

export default async function PolaroidPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meta = await loadPolaroid(id);
  if (!meta) notFound();

  const fit = meta.fitSignal;
  const rail = railFromPolaroidPayment(meta.payment);
  const kind = sourceKind({ curatorSlug: meta.curatorSlug, inventoryType: meta.inventoryType });
  const purchasable = kind !== "ai-designer";

  const notes = [
    ...(fit?.fitRecommendations ?? []),
    ...(fit?.styleRecommendations ?? []),
  ].slice(0, 2);

  const basisParts: string[] = [];
  if (fit) {
    if (fit.score != null) basisParts.push(`Fit read ${fit.score}/10`);
    if (fit.confidence != null) basisParts.push(`${Math.round(fit.confidence * 100)}% sure`);
    basisParts.push("from one photo, by a vision model");
  }
  const basis = basisParts.length ? basisParts.join(" · ") : "No fit read on this render.";

  const paidValue =
    rail === "paypal"
      ? `$${meta.payment.amountCusd} through PayPal`
      : rail === "near"
        ? `≈ $${meta.payment.amountCusd} in NEAR`
        : `${meta.payment.amountCusd} cUSD`;
  const proofLabel =
    rail === "paypal" ? "PayPal capture" : rail === "near" ? "Verified on NEAR" : "Verified on Celo";

  return (
    <>
      <PolaroidTracker polaroidId={id} />
      <ArtifactShell
      eyebrow="AI try-on"
      artifact={
        <div className="relative aspect-[3/4] border border-border bg-muted/20">
          <SafeImage
            sources={[meta.imageUrl]}
            alt={`${meta.item} — AI try-on`}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 600px"
            className="object-cover"
          />
          {fit?.score != null && (
            <div className="absolute right-3 top-3 flex items-center gap-1.5 bg-black/50 px-3 py-1 backdrop-blur-sm">
              <span className="font-mono text-xs uppercase tracking-wider text-white/70">
                Fit read
              </span>
              <span className="text-lg font-bold text-white">{fit.score}</span>
              <span className="text-xs text-white/50">/10</span>
            </div>
          )}
        </div>
      }
      title={meta.item}
      lede={
        <>
          by{" "}
          <TransitionLink
            href={`/s/${meta.curatorSlug}?item=${meta.listingId}`}
            className="font-medium text-primary hover:underline"
          >
            {meta.curatorName}
          </TransitionLink>
          <span className="mt-2 block"><SourceBadge kind={kind} /></span>
        </>
      }
      stickyAction={
        <PolaroidGetItLink
          curatorSlug={meta.curatorSlug}
          curatorName={meta.curatorName}
          listingId={meta.listingId}
          purchasable={purchasable}
        />
      }
      exits={
        <p className="mt-8 text-center text-xs text-muted-foreground/70">
          AI try-on — direction, not a perfect representation of fit.
        </p>
      }
    >
      <div className="mt-6">
        <p className="border-l-2 border-foreground pl-3 font-display text-xl leading-snug">
          {fitVerdict(fit)}
        </p>
        <p className="mt-1.5 pl-3 text-xs text-muted-foreground">{basis}</p>
      </div>

      {notes.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            What I noticed
          </p>
          <div className="space-y-1.5">
            {notes.map((note, i) => (
              <p key={i} className="text-sm leading-relaxed text-foreground/80">
                {note}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <FactList
          rows={[
            { label: "Paid", value: paidValue },
            {
              label: proofLabel,
              value: shortHash(meta.payment.txHash),
              href: meta.payment.explorerUrl || undefined,
              mono: true,
            },
            ...(meta.aiCost?.costUsd != null
              ? [
                  {
                    label: "Inference",
                    value: `$${Number(meta.aiCost.costUsd).toFixed(6)} via ${gatewayLabel(meta.aiCost.provider)}`,
                  },
                ]
              : []),
          ]}
        />
      </div>

      {kind === "ai-designer" ? (
        <p className="mt-6 text-sm text-muted-foreground">
          This is a digital design by an AI designer — there&rsquo;s no physical piece to buy yet.{" "}
          <Link href="/curators" className="font-semibold text-primary underline-offset-2 hover:underline">
            Ask a curator who stocks something like it
          </Link>
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <ShareArtifact
          title={`${meta.item} — AI try-on`}
          text={`Try-on for ${meta.item} by ${meta.curatorName}${fit?.score ? ` — fit score ${fit.score}/10` : ""}`}
          url={`/p/${id}`}
          imageUrl={meta.imageUrl}
        />
        <ReactionBar targetType="polaroid" targetId={id} lookSlug={`p-${id}`} />
      </div>
      <TryOnActionRail
        curatorSlug={meta.curatorSlug}
        listingId={meta.listingId}
        itemTitle={meta.item}
        imageUrl={meta.imageUrl}
      />
      <FirstBadge />
      {kind !== "ai-designer" ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Share this polaroid — when someone buys through your link you earn 2.5%.
        </p>
      ) : null}
    </ArtifactShell>
    </>
  );
}
