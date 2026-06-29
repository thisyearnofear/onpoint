"use client";

import React, { useEffect, useState } from "react";

/**
 * DashboardTooltips — first-visit contextual tooltips for dashboard tabs.
 *
 * Shows a single dismissible tooltip bubble on each tab the user hasn't
 * seen yet. Gated by localStorage so it only appears once per browser.
 * No external library — pure CSS positioning + React state.
 */

const STORAGE_KEY = "onpoint-dashboard-tooltips-seen";

interface TooltipDef {
  id: string;
  label: string;
  description: string;
}

const TOOLTIPS: TooltipDef[] = [
  { id: "dashboard", label: "Home", description: "Your dashboard — streak, activity, and quick actions." },
  { id: "try-on", label: "Try On", description: "Point your camera or upload a photo to get your outfit scored live." },
  { id: "stylist", label: "Stylist", description: "Chat with your AI stylist for personalized recommendations." },
  { id: "shop", label: "Shop", description: "Curated picks based on your style analysis." },
  { id: "my-looks", label: "My Looks", description: "Your saved style sessions — polaroids, scores, and share cards." },
  { id: "community", label: "Community", description: "Browse and share looks from the OnPoint community." },
  { id: "intel", label: "Market Intel", description: "Retail market trends and competitor pricing for your verticals." },
  { id: "settings", label: "Settings", description: "Wallet, connected accounts, subscription, and security." },
  { id: "more", label: "More", description: "Find Market Intel and Settings here." },
];

export function DashboardTooltips() {
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        setSeen(new Set(parsed));
        // If all tooltips have been seen, don't render anything
        if (parsed.length >= TOOLTIPS.length) {
          setDismissed(true);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const markSeen = (id: string) => {
    setSeen((prev) => {
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const dismissAll = () => {
    const all = new Set(TOOLTIPS.map((t) => t.id));
    setSeen(all);
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(TOOLTIPS.map((t) => t.id)));
    } catch {
      // ignore
    }
  };

  if (dismissed) return null;

  // Find the first unseen tooltip
  const next = TOOLTIPS.find((t) => !seen.has(t.id));
  if (!next) return null;

  return (
    <DashboardTooltip
      tooltip={next}
      onDismiss={() => markSeen(next.id)}
      onDismissAll={dismissAll}
    />
  );
}

function DashboardTooltip({
  tooltip,
  onDismiss,
  onDismissAll,
}: {
  tooltip: TooltipDef;
  onDismiss: () => void;
  onDismissAll: () => void;
}) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  useEffect(() => {
    // Find the tab button by its text content
    const findAnchor = () => {
      const buttons = document.querySelectorAll("button, a");
      for (const btn of buttons) {
        const text = btn.textContent?.trim() || "";
        if (text === tooltip.label || text.includes(tooltip.label)) {
          // Make sure it's a nav-level button (in the top bar or bottom nav)
          const rect = btn.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setAnchor(rect);
            return;
          }
        }
      }
      setAnchor(null);
    };

    findAnchor();
    // Re-find on resize since layout shifts
    window.addEventListener("resize", findAnchor);
    const timer = setTimeout(findAnchor, 300); // After animations settle
    return () => {
      window.removeEventListener("resize", findAnchor);
      clearTimeout(timer);
    };
  }, [tooltip.label]);

  if (!anchor) return null;

  // Position the tooltip below the anchor, centered
  const left = anchor.left + anchor.width / 2;
  const top = anchor.bottom + 8;

  // Clamp to viewport
  const tooltipWidth = 280;
  const clampedLeft = Math.max(
    tooltipWidth / 2 + 8,
    Math.min(left, window.innerWidth - tooltipWidth / 2 - 8),
  );

  return (
    <>
      {/* Invisible backdrop to catch clicks */}
      <div
        className="fixed inset-0 z-[70]"
        onClick={onDismiss}
      />
      {/* Tooltip bubble */}
      <div
        className="fixed z-[71] pointer-events-auto"
        style={{
          left: clampedLeft - tooltipWidth / 2,
          top,
          width: tooltipWidth,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-foreground text-background rounded-2xl shadow-2xl p-4 animate-fade-in">
          {/* Arrow */}
          <div
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-foreground rotate-45"
            style={{ left: left - (clampedLeft - tooltipWidth / 2) - 6 }}
          />
          <div className="flex items-start justify-between mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-background/60">
              {tooltip.label}
            </span>
            <button
              onClick={onDismiss}
              className="text-background/40 hover:text-background/70 text-xs"
            >
              Got it
            </button>
          </div>
          <p className="text-sm text-background/90 leading-relaxed">
            {tooltip.description}
          </p>
          <button
            onClick={onDismissAll}
            className="mt-2 text-[10px] text-background/40 hover:text-background/60 transition-colors"
          >
            Don&apos;t show any tooltips
          </button>
        </div>
      </div>
    </>
  );
}
