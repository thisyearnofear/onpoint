import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, Sparkles, ShoppingBag } from "lucide-react";
import { OnPointHeader, OnPointFooter } from "../../../components/OnPointHeader";
import { TransitionLink } from "../../../components/ViewTransition";
import { getApiBase } from "../../../lib/utils/api-base";
import { PolaroidShareButtons } from "./PolaroidShareButtons";

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
  const scoreColor =
    fit?.score == null
      ? "text-muted-foreground"
      : fit.score >= 8
        ? "text-emerald-400"
        : fit.score >= 6
          ? "text-amber-400"
          : "text-orange-400";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <OnPointHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Polaroid card — branded, shareable */}
          <div className="bg-card rounded-3xl overflow-hidden shadow-2xl border border-border">
            {/* Image */}
            <div className="relative aspect-[3/4] bg-muted/20">
              <img
                src={meta.imageUrl}
                alt={`${meta.item} — AI try-on`}
                className="w-full h-full object-cover"
              />
              {/* Branding overlay */}
              <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-white/90" />
                  <span className="text-sm font-black text-white tracking-tight italic">
                    OnPoint
                  </span>
                </div>
                {fit?.score != null && (
                  <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1">
                    <span className="text-[10px] font-mono text-white/60 uppercase tracking-wider">
                      Score
                    </span>
                    <span className={`text-lg font-black ${scoreColor}`}>
                      {fit.score}
                    </span>
                    <span className="text-xs text-white/40">/10</span>
                  </div>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Item + curator */}
              <div>
                <h1 className="text-xl font-bold text-foreground leading-tight">
                  {meta.item}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  by{" "}
                  <TransitionLink
                    href={`/s/${meta.curatorSlug}`}
                    className="text-primary hover:underline font-medium"
                  >
                    {meta.curatorName}
                  </TransitionLink>
                </p>
              </div>

              {/* Fit signal */}
              {fit && (
                <div className="space-y-3">
                  {fit.recommendedSize && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-sm text-emerald-300">
                        Recommended size:{" "}
                        <span className="font-bold">{fit.recommendedSize}</span>
                        {fit.confidence != null && (
                          <span className="text-emerald-400/60 ml-1.5">
                            ({Math.round(fit.confidence * 100)}% confidence)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {fit.fitRecommendations.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-bold">
                        Fit Notes
                      </p>
                      {fit.fitRecommendations.slice(0, 3).map((r, i) => (
                        <p
                          key={i}
                          className="text-xs text-foreground/70 leading-relaxed"
                        >
                          {r}
                        </p>
                      ))}
                    </div>
                  )}
                  {fit.styleRecommendations.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-bold">
                        Style Notes
                      </p>
                      {fit.styleRecommendations.slice(0, 2).map((r, i) => (
                        <p
                          key={i}
                          className="text-xs text-foreground/70 leading-relaxed"
                        >
                          {r}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* On-chain proof */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/50">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-xs text-muted-foreground">
                  Verified on Celo —{" "}
                  <a
                    href={meta.payment.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    {meta.payment.amountCusd} cUSD paid
                  </a>
                </span>
              </div>

              {/* Social share — drives viral loop */}
              <PolaroidShareButtons
                item={meta.item}
                curatorName={meta.curatorName}
                score={fit?.score ?? null}
              />

              {/* CTA — shop the real thing */}
              <TransitionLink
                href={`/s/${meta.curatorSlug}`}
                className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-full py-4 text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all"
              >
                <ShoppingBag className="w-4 h-4" />
                Shop {meta.curatorName}
                <ArrowRight className="w-3.5 h-3.5 opacity-60" />
              </TransitionLink>
            </div>
          </div>

          {/* Footer hint */}
          <p className="text-center text-xs text-muted-foreground/50 mt-4">
            AI try-on powered by OnPoint. Not a perfect representation of fit.
          </p>
        </div>
      </main>
      <OnPointFooter />
    </div>
  );
}
