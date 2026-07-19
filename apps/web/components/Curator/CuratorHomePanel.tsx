"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowRight,
  Bot,
  Camera,
  Check,
  Eye,
  Loader2,
  MessageCircle,
  MousePointerClick,
  Share2,
  Trash2,
  TrendingUp,
  Upload,
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
import { getApiBase } from "../../lib/utils/api-base";

interface CuratorHomePanelProps {
  curatorSlug: string;
  curatorName: string;
  storefrontUrl: string;
  /** Curator's WhatsApp number — required for look management auth headers */
  whatsapp?: string;
  /** Tighter layout for onboard success page */
  compact?: boolean;
}

interface LookSummary {
  slug: string;
  title: string;
  status: string;
  tryOnCount: number;
  shareCount: number;
  purchaseCount: number;
  coverImageUrl?: string | null;
  heroImageUrl?: string | null;
  collageUrl?: string | null;
}

type BulkAction = "archive" | "publish" | "delete";

export function CuratorHomePanel({
  curatorSlug,
  curatorName,
  storefrontUrl,
  whatsapp,
  compact = false,
}: CuratorHomePanelProps) {
  const [snapshot, setSnapshot] = useState<CuratorHomeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Look management state ──
  const [drafts, setDrafts] = useState<LookSummary[]>([]);
  const [myLooks, setMyLooks] = useState<LookSummary[]>([]);
  const [looksLoading, setLooksLoading] = useState(false);
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [draftActionBusy, setDraftActionBusy] = useState<string | null>(null);
  const [lookError, setLookError] = useState<string | null>(null);

  const authHeaders = useMemo(
    () =>
      whatsapp
        ? { "x-curator-slug": curatorSlug, "x-curator-whatsapp": whatsapp }
        : null,
    [whatsapp, curatorSlug],
  );

  const fetchMyLooks = useCallback(async () => {
    if (!authHeaders) return;
    setLooksLoading(true);
    setLookError(null);
    try {
      // Fetch live looks and drafts in parallel
      const [liveRes, draftRes] = await Promise.all([
        fetch(
          `${getApiBase()}/api/looks?curator=${encodeURIComponent(curatorSlug)}&status=live&limit=100`,
          { headers: authHeaders },
        ),
        fetch(
          `${getApiBase()}/api/looks?curator=${encodeURIComponent(curatorSlug)}&status=draft&limit=100`,
          { headers: authHeaders },
        ),
      ]);

      const liveData = liveRes.ok ? await liveRes.json().catch(() => ({ looks: [] })) : { looks: [] };
      const draftData = draftRes.ok ? await draftRes.json().catch(() => ({ looks: [] })) : { looks: [] };

      setMyLooks(liveData.looks || []);
      setDrafts(draftData.looks || []);
    } catch {
      setLookError("Failed to load your looks");
    } finally {
      setLooksLoading(false);
    }
  }, [authHeaders, curatorSlug]);

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

  useEffect(() => {
    fetchMyLooks();
  }, [fetchMyLooks]);

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

  // ── Draft actions: publish or delete a single draft ──
  async function handleDraftAction(slug: string, action: "publish" | "delete") {
    if (!authHeaders) return;
    setDraftActionBusy(slug);
    setLookError(null);
    try {
      if (action === "publish") {
        const res = await fetch(`${getApiBase()}/api/looks/${slug}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ status: "live" }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setLookError(data.error || "Failed to publish draft");
          return;
        }
      } else {
        const res = await fetch(`${getApiBase()}/api/looks/${slug}`, {
          method: "DELETE",
          headers: authHeaders,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setLookError(data.error || "Failed to delete draft");
          return;
        }
      }
      await fetchMyLooks();
    } catch {
      setLookError("Network error — please try again");
    } finally {
      setDraftActionBusy(null);
    }
  }

  // ── Bulk actions on selected looks ──
  function toggleSelect(slug: string) {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function selectAll() {
    setSelectedSlugs(new Set(myLooks.map((l) => l.slug)));
  }

  function clearSelection() {
    setSelectedSlugs(new Set());
  }

  async function handleBulkAction(action: BulkAction) {
    if (!authHeaders || selectedSlugs.size === 0) return;
    setBulkBusy(true);
    setLookError(null);
    try {
      const res = await fetch(`${getApiBase()}/api/looks/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ action, slugs: [...selectedSlugs] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLookError(data.error || "Bulk action failed");
        return;
      }
      if (data.failed?.length > 0) {
        setLookError(`${data.failed.length} look(s) could not be updated: ${data.failed.map((f: { slug: string; error: string }) => f.slug).join(", ")}`);
      }
      clearSelection();
      await fetchMyLooks();
    } catch {
      setLookError("Network error — please try again");
    } finally {
      setBulkBusy(false);
    }
  }

  const selectedCount = selectedSlugs.size;

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
        <div className="rounded-xl border border-success/20 bg-success/5 p-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-success" />
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
              ? "border-success/30 bg-success/5"
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
              ? "border-warning/30 bg-warning/5"
              : "border-primary/20 bg-primary/5"
          }`}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className={`h-4 w-4 ${nudge.urgency === "high" ? "text-warning" : "text-primary"}`} />
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

      {/* ── Draft looks section (creator-only) ── */}
      {whatsapp && (
        <div className="mt-6 rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">Draft looks</p>
            {drafts.length > 0 && (
              <span className="text-xs text-muted-foreground">{drafts.length} draft{drafts.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          {looksLoading && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading drafts...
            </div>
          )}

          {!looksLoading && drafts.length === 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              No drafts. Save an incomplete look as a draft from the look creator below.
            </p>
          )}

          {!looksLoading && drafts.length > 0 && (
            <div className="mt-3 space-y-2">
              {drafts.map((look) => (
                <div
                  key={look.slug}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-background px-3 py-2 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{look.title}</p>
                    <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase text-warning dark:text-amber-400">
                      Draft
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDraftAction(look.slug, "publish")}
                    disabled={draftActionBusy === look.slug}
                    className="inline-flex items-center gap-1 rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-bold text-background transition-colors hover:bg-foreground/90 disabled:opacity-40"
                  >
                    {draftActionBusy === look.slug ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                    Publish
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDraftAction(look.slug, "delete")}
                    disabled={draftActionBusy === look.slug}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── My Looks section with bulk actions (creator-only) ── */}
      {whatsapp && (
        <div className="mt-6 rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">My Looks</p>
            {myLooks.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectedCount === myLooks.length ? clearSelection : selectAll}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {selectedCount === myLooks.length ? "Deselect all" : "Select all"}
                </button>
              </div>
            )}
          </div>

          {looksLoading && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading your looks...
            </div>
          )}

          {!looksLoading && myLooks.length === 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              No published looks yet. Create one with the look creator below.
            </p>
          )}

          {!looksLoading && myLooks.length > 0 && (
            <>
              <div className="mt-3 space-y-2">
                {myLooks.map((look) => {
                  const isSelected = selectedSlugs.has(look.slug);
                  return (
                    <div
                      key={look.slug}
                      className={`flex flex-col gap-3 rounded-lg border px-3 py-2 transition-colors sm:flex-row sm:items-center ${
                        isSelected ? "border-foreground/30 bg-foreground/5" : "border-border bg-background"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSelect(look.slug)}
                        className="flex shrink-0 items-center justify-center"
                        aria-label={isSelected ? "Deselect look" : "Select look"}
                      >
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded border ${
                            isSelected ? "border-foreground bg-foreground text-background" : "border-border"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </span>
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{look.title}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-0.5">
                            <Eye className="h-3 w-3" />
                            {look.tryOnCount ?? 0}
                          </span>
                          <span className="inline-flex items-center gap-0.5">
                            <Share2 className="h-3 w-3" />
                            {look.shareCount ?? 0}
                          </span>
                          <span className="rounded-full bg-success/10 px-1.5 py-0.5 font-bold uppercase text-success dark:text-emerald-400">
                            Live
                          </span>
                        </div>
                      </div>
                      <Link
                        href={`/look/${look.slug}`}
                        className="shrink-0 text-xs font-medium text-primary hover:underline"
                      >
                        View
                      </Link>
                    </div>
                  );
                })}
              </div>

              {/* Bulk action bar */}
              {selectedCount > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {selectedCount} selected
                  </span>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleBulkAction("archive")}
                      disabled={bulkBusy}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-40"
                    >
                      {bulkBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
                      Archive ({selectedCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkAction("publish")}
                      disabled={bulkBusy}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-40"
                    >
                      {bulkBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                      Publish ({selectedCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkAction("delete")}
                      disabled={bulkBusy}
                      className="inline-flex items-center gap-1 rounded-lg border border-error/30 px-2.5 py-1.5 text-xs font-medium text-error transition-colors hover:bg-error/5 disabled:opacity-40 dark:text-red-400"
                    >
                      {bulkBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Delete ({selectedCount})
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {lookError && (
        <div className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-xs text-red-700 dark:text-red-400">
          {lookError}
        </div>
      )}
    </div>
  );
}
