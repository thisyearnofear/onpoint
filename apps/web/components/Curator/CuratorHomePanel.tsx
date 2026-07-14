"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Camera,
  Eye,
  MessageCircle,
  MousePointerClick,
  Share2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { StatCard } from "./StatCard";
import {
  agentChannelLabel,
  buildWhatsAppBriefPreview,
  fetchCuratorHomeSnapshot,
  funnelInsight,
  nudgeInsight,
  type CuratorHomeSnapshot,
} from "../../lib/services/curator-home";

interface CuratorHomePanelProps {
  curatorSlug: string;
  curatorName: string;
  storefrontUrl: string;
  /** Tighter layout for onboard success page */
  compact?: boolean;
}

export function CuratorHomePanel({
  curatorSlug,
  curatorName,
  storefrontUrl,
  compact = false,
}: CuratorHomePanelProps) {
  const [snapshot, setSnapshot] = useState<CuratorHomeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCuratorHomeSnapshot(curatorSlug)
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [curatorSlug]);

  const funnel = snapshot?.funnel ?? {
    pageViews: 0,
    tryOns: 0,
    shares: 0,
    buyClicks: 0,
  };
  const listingCount = snapshot?.listingCount ?? 0;
  const agent = agentChannelLabel(
    snapshot?.agentPurchasable ?? false,
    snapshot?.wallet?.payoutWalletStatus,
  );
  const nudge = nudgeInsight({
    agentPurchasable: snapshot?.agentPurchasable ?? false,
    walletStatus: snapshot?.wallet?.payoutWalletStatus,
    activatedAt: snapshot?.wallet?.activatedAt,
    activeStorefronts: snapshot?.nudge?.activeStorefronts,
    betaSpotsRemaining: snapshot?.nudge?.betaSpotsRemaining,
    tryOns: funnel.tryOns,
  });
  const brief = buildWhatsAppBriefPreview({
    curatorName,
    listing: snapshot?.firstListing,
  });

  const intelUrl = `/s/${curatorSlug}/intel`;
  const walletUrl = `/curator/wallet?slug=${encodeURIComponent(curatorSlug)}`;

  return (
    <div
      className={`w-full rounded-2xl border border-border bg-card text-left ${
        compact ? "p-5" : "p-6"
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Your business on OnPoint
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight">
            {loading ? "Loading your stats…" : funnelInsight(funnel, listingCount)}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={intelUrl}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            Full stats
            <ArrowRight className="h-3 w-3" />
          </Link>
          <Link
            href={walletUrl}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            <Wallet className="h-3 w-3" />
            Payout wallet
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Eye} label="Views" value={loading ? "—" : funnel.pageViews} color="#3b82f6" />
        <StatCard icon={Camera} label="Try-ons" value={loading ? "—" : funnel.tryOns} color="#8b5cf6" />
        <StatCard icon={Share2} label="Shares" value={loading ? "—" : funnel.shares} color="#22c55e" />
        <StatCard
          icon={MousePointerClick}
          label="Buy taps"
          value={loading ? "—" : funnel.buyClicks}
          color="#f59e0b"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-emerald-500" />
            <p className="text-sm font-bold">Sample WhatsApp brief</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            After try-on, shoppers tap buy and you get a ready-to-act message — not just
            &ldquo;do you have this?&rdquo;
          </p>
          <div className="mt-3 rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground">
            {brief}
          </div>
          <Link
            href={storefrontUrl}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <TrendingUp className="h-3 w-3" />
            Open your storefront to try it yourself
          </Link>
        </div>

        <div
          className={`rounded-xl border p-4 ${
            agent.tone === "ready"
              ? "border-emerald-500/30 bg-emerald-500/5"
              : agent.tone === "setup"
                ? "border-primary/30 bg-primary/5"
                : "border-border bg-muted/30"
          }`}
        >
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <p className="text-sm font-bold">{agent.title}</p>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{agent.body}</p>
          {agent.tone !== "ready" && (
            <Link
              href={walletUrl}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Set up payout wallet
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>

      {/* Nudge / FOMO banner */}
      {nudge.urgency !== "none" && !loading && (
        <div
          className={`mt-4 flex items-center justify-between gap-3 rounded-xl border p-3 ${
            nudge.urgency === "high"
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-primary/20 bg-primary/5"
          }`}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className={`h-4 w-4 ${nudge.urgency === "high" ? "text-amber-500" : "text-primary"}`} />
            <div>
              <p className="text-sm font-bold">{nudge.headline}</p>
              <p className="text-xs text-muted-foreground">{nudge.detail}</p>
            </div>
          </div>
          {nudge.urgency === "high" && (
            <Link
              href={walletUrl}
              className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {nudge.cta}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
