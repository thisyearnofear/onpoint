import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { TransitionLink } from "../../../components/ViewTransition";
import { SafeImage } from "../../../components/SafeImage";
import { ArtifactShell } from "../../../components/surface/ArtifactShell";
import { FactList, shortHash } from "../../../components/surface/FactList";
import { ShareArtifact } from "../../../components/ShareArtifact";
import { PolaroidGetItLink } from "./PolaroidGetItLink";
import { PolaroidTracker } from "./PolaroidTracker";

export const dynamic = "force-dynamic";

interface PolaroidMeta {
  item: string;
  curatorSlug: string;
  curatorName: string;
  listingId: string;
  inventoryType: string;
  imageUrl: string;
  fitSignal: {
    bodyType: string | null;
    recommendedSize: string | null;
    score: number | null;
    confidence: number | null;
    fitRecommendations: string[];
    styleRecommendations: string[];
  } | null;
  stylingTips: string[];
  payment: {
    txHash: string;
    amountCusd: string;
    explorerUrl: string;
  };
  storefrontUrl: string;
  createdAt: string;
}

async function loadPolaroid(id: string): Promise<PolaroidMeta | null> {
  const r2Base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!r2Base) return null;
  try {
    const res = await fetch(`${r2Base}/polaroids/${id}.json`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
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
  const description = `AI try-on for ${meta.item} by ${meta.curatorName}.${scoreText ? ` ${scoreText}.` : ""} See the fit, then shop the real thing on OnPoint.`;
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

  const notes = [
    ...(fit?.fitRecommendations ?? []),
    ...(fit?.styleRecommendations ?? []),
  ].slice(0, 2);

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
            unoptimized
            className="object-cover"
          />
          {fit?.score != null && (
            <div className="absolute right-3 top-3 flex items-center gap-1.5 bg-black/50 px-3 py-1 backdrop-blur-sm">
              <span className="font-mono text-xs uppercase tracking-wider text-white/70">
                Score
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
          {fit?.recommendedSize && (
            <span className="mt-1 flex items-center gap-1.5 text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Recommended size: <span className="font-bold">{fit.recommendedSize}</span>
              {fit.confidence != null && (
                <span className="text-success/60">
                  ({Math.round(fit.confidence * 100)}%)
                </span>
              )}
            </span>
          )}
        </>
      }
      stickyAction={
        <PolaroidGetItLink
          curatorSlug={meta.curatorSlug}
          curatorName={meta.curatorName}
          listingId={meta.listingId}
        />
      }
      exits={
        <p className="mt-8 text-center text-xs text-muted-foreground/70">
          AI try-on — direction, not a perfect representation of fit.
        </p>
      }
    >
      {notes.length > 0 && (
        <div className="mt-6 space-y-1.5">
          {notes.map((note, i) => (
            <p key={i} className="text-sm leading-relaxed text-foreground/80">
              {note}
            </p>
          ))}
        </div>
      )}

      <div className="mt-6">
        <FactList
          rows={[
            {
              label: "Paid",
              value: `${meta.payment.amountCusd} cUSD`,
            },
            {
              label: "Verified on Celo",
              value: shortHash(meta.payment.txHash),
              href: meta.payment.explorerUrl,
              mono: true,
            },
          ]}
        />
      </div>

      <div className="mt-6">
        <ShareArtifact
          title={`${meta.item} — AI try-on`}
          text={`Try-on for ${meta.item} by ${meta.curatorName}${fit?.score ? ` — fit score ${fit.score}/10` : ""}`}
          url={`/p/${id}`}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Share this polaroid — when someone buys through your link you earn 2.5%.
        </p>
      </div>
    </ArtifactShell>
    </>
  );
}
