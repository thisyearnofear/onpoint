"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Check,
  Store,
  Package,
  Camera,
  Share2,
  Eye,
  ArrowRight,
} from "lucide-react";

interface OnboardingChecklistProps {
  curatorSlug: string;
  storefrontUrl: string;
}

interface ChecklistStep {
  id: string;
  label: string;
  description: string;
  icon: typeof Store;
  href: string;
  ctaLabel: string;
  check: () => Promise<boolean>;
}

/**
 * Visual progress tracker for curators — shows them exactly where
 * they are on the path from signup to first sale.
 *
 * Steps:
 * 1. Storefront created (always done — they're on this page)
 * 2. First item added (checks storefront API for listings)
 * 3. Tried on your own item (checks localStorage)
 * 4. Shared your link (checks localStorage)
 * 5. First visitor (checks analytics API)
 */
export function OnboardingChecklist({ curatorSlug, storefrontUrl }: OnboardingChecklistProps) {
  const [steps, setSteps] = useState<Array<{ id: string; done: boolean; loading: boolean }>>([
    { id: "storefront", done: true, loading: false },
    { id: "inventory", done: false, loading: true },
    { id: "tryon", done: false, loading: true },
    { id: "share", done: false, loading: true },
    { id: "visitor", done: false, loading: true },
  ]);

  useEffect(() => {
    async function checkProgress() {
      // Check inventory
      try {
        const res = await fetch(`/api/curator/${curatorSlug}/storefront`);
        if (res.ok) {
          const data = await res.json();
          const hasListings = data.listings?.length > 0;
          setSteps((prev) =>
            prev.map((s) => (s.id === "inventory" ? { ...s, done: hasListings, loading: false } : s)),
          );
        } else {
          setSteps((prev) => prev.map((s) => (s.id === "inventory" ? { ...s, loading: false } : s)));
        }
      } catch {
        setSteps((prev) => prev.map((s) => (s.id === "inventory" ? { ...s, loading: false } : s)));
      }

      // Check try-on (localStorage)
      try {
        const triedOn = localStorage.getItem(`onpoint_tried_on_${curatorSlug}`);
        setSteps((prev) =>
          prev.map((s) => (s.id === "tryon" ? { ...s, done: !!triedOn, loading: false } : s)),
        );
      } catch {
        setSteps((prev) => prev.map((s) => (s.id === "tryon" ? { ...s, loading: false } : s)));
      }

      // Check share (localStorage)
      try {
        const shared = localStorage.getItem(`onpoint_shared_${curatorSlug}`);
        setSteps((prev) =>
          prev.map((s) => (s.id === "share" ? { ...s, done: !!shared, loading: false } : s)),
        );
      } catch {
        setSteps((prev) => prev.map((s) => (s.id === "share" ? { ...s, loading: false } : s)));
      }

      // Check visitor (analytics API)
      try {
        const res = await fetch(`/api/curator/analytics/funnel?slug=${curatorSlug}`);
        if (res.ok) {
          const data = await res.json();
          const hasVisitors = (data.pageViews || 0) > 0;
          setSteps((prev) =>
            prev.map((s) => (s.id === "visitor" ? { ...s, done: hasVisitors, loading: false } : s)),
          );
        } else {
          setSteps((prev) => prev.map((s) => (s.id === "visitor" ? { ...s, loading: false } : s)));
        }
      } catch {
        setSteps((prev) => prev.map((s) => (s.id === "visitor" ? { ...s, loading: false } : s)));
      }
    }

    checkProgress();
  }, [curatorSlug]);

  const completedCount = steps.filter((s) => s.done).length;
  const progress = (completedCount / steps.length) * 100;

  const stepConfig: Record<string, { label: string; description: string; icon: typeof Store; href: string; ctaLabel: string }> = {
    storefront: {
      label: "Storefront created",
      description: "Your branded page is live",
      icon: Store,
      href: storefrontUrl,
      ctaLabel: "View",
    },
    inventory: {
      label: "Add your first item",
      description: "Add a kit so customers can try it on",
      icon: Package,
      href: storefrontUrl,
      ctaLabel: "Add item",
    },
    tryon: {
      label: "Try on your own item",
      description: "Experience what your customers see",
      icon: Camera,
      href: "/s/wanja?demo=1",
      ctaLabel: "Try it",
    },
    share: {
      label: "Share your link",
      description: "Put it in your WhatsApp status or IG bio",
      icon: Share2,
      href: storefrontUrl,
      ctaLabel: "Share",
    },
    visitor: {
      label: "Get your first visitor",
      description: "Someone views your storefront",
      icon: Eye,
      href: `/s/${curatorSlug}/intel`,
      ctaLabel: "Check stats",
    },
  };

  return (
    <div className="w-full">
      <div className="rounded-2xl border border-border bg-card p-6">
        {/* Progress header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Your progress</h3>
          <span className="text-sm font-bold text-primary">
            {completedCount}/{steps.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-6 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step) => {
            const config = stepConfig[step.id];
            if (!config) return null;
            const Icon = config.icon;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                  step.done
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-border bg-background"
                }`}
              >
                {/* Status icon */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    step.done
                      ? "bg-emerald-500 text-white"
                      : step.loading
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary"
                  }`}
                >
                  {step.done ? (
                    <Check className="h-4 w-4" />
                  ) : step.loading ? (
                    <div className="h-3 w-3 animate-pulse rounded-full bg-current opacity-50" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>

                {/* Label + description */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${step.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {config.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{config.description}</p>
                </div>

                {/* CTA */}
                {!step.done && !step.loading && (
                  <Link
                    href={config.href}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted active:scale-[0.98]"
                  >
                    {config.ctaLabel}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        {/* Completion message */}
        {completedCount === steps.length && (
          <div className="mt-4 rounded-lg bg-emerald-500/10 p-3 text-center text-sm font-medium text-emerald-600">
            You&apos;re all set! Your storefront is live, stocked, and shared.
            Now wait for those try-on briefs to roll in.
          </div>
        )}
      </div>
    </div>
  );
}
