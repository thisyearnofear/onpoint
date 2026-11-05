"use client";

import React, { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
// framer-motion removed — using CSS transitions instead
import {
  Palette,
  Camera,
  MessageCircle,
  LayoutDashboard,
  ShoppingBag,
  User,
  Radar,
  Grid,
  X,
} from "lucide-react";
import { NotificationBell } from "../NotificationBell";
import { AgentWalletBadge } from "../AgentWalletBadge";
import { AttestationBadge } from "../AttestationBadge";
import { EnhancedConnectButton } from "../EnhancedConnectButton";
import type { FashionItem } from "@onpoint/shared-types";
import {
  fashionItemToTryOnSelection,
  setPendingTryOnSelection,
} from "../../lib/utils/try-on-selection";

import dynamic from "next/dynamic";
import { TryOnPanel } from "./TryOnPanel";
import { NewUserOnboarding } from "./NewUserOnboarding";
import { useModalA11y } from "../../lib/hooks/use-modal-a11y";

const PanelLoading = () => (
  <div className="flex min-h-[30vh] items-center justify-center" role="status">
    <span className="text-xs font-semibold text-muted-foreground">Loading panel…</span>
  </div>
);
const StylistPanel = dynamic(() => import("./StylistPanel").then((m) => m.StylistPanel), { loading: PanelLoading });
const ShopPanel = dynamic(() => import("./ShopPanel").then((m) => m.ShopPanel), { loading: PanelLoading });
const HomePanel = dynamic(() => import("./HomePanel").then((m) => m.HomePanel), { loading: PanelLoading });
const MyLooksPanel = dynamic(() => import("./MyLooksPanel").then((m) => m.MyLooksPanel), { loading: PanelLoading });
// DesignPanel and CommunityPanel are quarantined (ADR 0014).
// They are retained in the codebase for Phase 2 demand-side discovery rewiring
// but unwired from the Lab UI per "agent layer becomes infrastructure, not the hero" (ADR 0002).
const SettingsPanel = dynamic(() => import("./SettingsPanel").then((m) => m.SettingsPanel), { loading: PanelLoading });
const MarketIntelPanel = dynamic(() => import("./MarketIntelPanel").then((m) => m.MarketIntelPanel), { loading: PanelLoading });
// CommunityPanel import removed — quarantined per ADR 0014 (demand-side discovery, pending Phase 2 rewiring).
import { DashboardTooltips } from "./DashboardTooltips";

type AppMode = "dashboard" | "my-looks" | "try-on" | "stylist" | "shop" | "intel" | "settings";

// All valid modes (for URL param validation). Module scope so the effect below
// reads a stable reference — the array literal never re-triggers the effect.
const ALL_MODES: AppMode[] = ["dashboard", "my-looks", "try-on", "stylist", "shop", "intel", "settings"];

interface TacticalDashboardProps {
  onBack?: () => void;
}

export function TacticalDashboard({ onBack: _onBack }: TacticalDashboardProps) {
  // Default to try-on (fit rail). URL ?tab= still deep-links power surfaces.
  const [mode, setMode] = useState<AppMode>("try-on");

  // Deep-link context from storefront or external pages
  const [deepLinkContext, setDeepLinkContext] = React.useState<{
    from?: string;
    item?: string;
    persona?: string;
  } | null>(null);

  // Listen for URL tab param (e.g. from Connected Accounts nav link or storefront)
  const searchParams = useSearchParams();
  React.useEffect(() => {
    const tab = searchParams.get("tab") as AppMode | null;
    const from = searchParams.get("from") || undefined;
    const item = searchParams.get("item") || undefined;
    const persona = searchParams.get("persona") || undefined;

    if (tab && ALL_MODES.includes(tab)) {
      setMode(tab);
      if (from || item || persona) {
        setDeepLinkContext({ from, item, persona });
      }
      // Clean the URL so bookmarking doesn't persist a transient tab
      window.history.replaceState(null, "", window.location.pathname);
    } else if (persona) {
      // Persona deep-links (e.g. from the look crafter) go straight to try-on,
      // even without an explicit tab param.
      setMode("try-on");
      setDeepLinkContext({ persona });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams]);

  // All valid modes (for URL param validation) — ALL_MODES is defined at module scope.

  // Desktop top-bar: fit + shop first; community/intel in More
  const desktopNavItems = [
    { id: "try-on" as AppMode, label: "Try On", icon: Camera },
    { id: "shop" as AppMode, label: "Shop", icon: ShoppingBag },
    { id: "stylist" as AppMode, label: "Stylist", icon: MessageCircle },
    { id: "my-looks" as AppMode, label: "My Looks", icon: Palette },
    { id: "dashboard" as AppMode, label: "Home", icon: LayoutDashboard },
  ];

  // Hidden tabs accessible via "More" — only sections not on the primary
  // rail for the viewport (mobile shows Stylist/My Looks, which have no
  // bottom-nav slot; desktop hides them because they're in the tab bar).
  const moreNavItems = [
    { id: "stylist" as AppMode, label: "Stylist", icon: MessageCircle, mobileOnly: true },
    { id: "my-looks" as AppMode, label: "My Looks", icon: Palette, mobileOnly: true },
    { id: "intel" as AppMode, label: "Market Intel", icon: Radar, mobileOnly: false },
    { id: "settings" as AppMode, label: "Settings", icon: User, mobileOnly: false },
  ];

  const [moreOpen, setMoreOpen] = useState(false);
  const moreSheetRef = useModalA11y<HTMLDivElement>(moreOpen, () => setMoreOpen(false));

  // Route map — each mode maps to its content factory
  const contentMap: Record<AppMode, () => ReactNode> = {
    dashboard: () => <HomePanel onNavigate={(m) => setMode(m as AppMode)} />,
    "my-looks": () => <MyLooksPanel onNavigate={(m) => setMode(m as AppMode)} />,
    "try-on": () => <TryOnPanel
      deepLinkFrom={deepLinkContext?.from}
      deepLinkItem={deepLinkContext?.item}
      deepLinkPersona={deepLinkContext?.persona}
      onDismissDeepLink={() => setDeepLinkContext(null)}
    />,
    stylist: () => <StylistPanel />,
    intel: () => <MarketIntelPanel />,
    shop: () => (
      <ShopPanel
        onTryOn={(item?: FashionItem) => {
          if (item) {
            setPendingTryOnSelection(fashionItemToTryOnSelection(item));
          }
          setMode("try-on");
        }}
      />
    ),
    settings: () => <SettingsPanel />,
  };

  const renderContent = () => contentMap[mode]();

  const navigateTo = (id: AppMode) => {
    setMode(id);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", id);
      window.history.replaceState(null, "", url.toString());
    }
  };

  return (
    <>
      {mode === "dashboard" && (
        <>
          <NewUserOnboarding />
          <DashboardTooltips />
        </>
      )}
      <div className="flex flex-col min-h-screen bg-background">

      {/* ── Desktop top tab bar (hidden on mobile) ── */}
      <div className="hidden md:block sticky top-16 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-stretch gap-1 overflow-x-auto no-scrollbar" role="tablist" aria-label="Fitting room sections">
            {desktopNavItems.map((item) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={mode === item.id}
                onClick={() => navigateTo(item.id)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 whitespace-nowrap transition-colors ${
                  mode === item.id
                    ? "border-primary text-foreground font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span className="text-sm">{item.label}</span>
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1">
              {/* Desktop More button — Market Intel + Settings */}
              <button
                onClick={() => setMoreOpen(true)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 whitespace-nowrap transition-colors ${
                  mode === "intel" || mode === "settings"
                    ? "border-primary text-foreground font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Grid className="w-4 h-4" />
                <span className="text-sm">More</span>
              </button>
              <div className="px-2 py-2"><NotificationBell /></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 container mx-auto px-4 py-6 pb-24 md:py-8 md:pb-8">
        <div className="animate-fade-in">{renderContent()}</div>
      </main>

      {/* ── Mobile bottom nav (hidden on desktop) ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-xl border-t border-border" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-end justify-around h-16 max-w-lg mx-auto">
          {/* Home */}
          <button
            onClick={() => navigateTo("dashboard")}
            className={`flex flex-col items-center gap-0.5 pt-2 pb-1 px-3 transition-colors ${
              mode === "dashboard" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-xs font-medium">Home</span>
          </button>

          {/* Shop */}
          <button
            onClick={() => navigateTo("shop")}
            className={`flex flex-col items-center gap-0.5 pt-2 pb-1 px-3 transition-colors ${
              mode === "shop" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="text-xs font-medium">Shop</span>
          </button>

          {/* Try On — elevated center button */}
          <div className="flex flex-col items-center -mt-5">
            <button
              onClick={() => navigateTo("try-on")}
              className={`flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all ${
                mode === "try-on"
                  ? "bg-primary text-white shadow-primary/30 scale-95"
                  : "bg-primary text-white shadow-primary/25 hover:shadow-primary/40"
              }`}
            >
              <Camera className="w-6 h-6" />
            </button>
            <span className={`text-xs font-medium mt-0.5 ${mode === "try-on" ? "text-primary" : "text-muted-foreground"}`}>
              Try On
            </span>
          </div>

          {/* More — opens sheet with hidden tabs */}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center gap-0.5 pt-2 pb-1 px-3 transition-colors ${
              moreNavItems.some((item) => item.id === mode) ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Grid className="w-5 h-5" />
            <span className="text-xs font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* ── "More" sheet (hidden tabs — works on both mobile and desktop) ── */}
      {moreOpen && (
        <div className="fixed inset-0 z-[60]" onClick={() => setMoreOpen(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          {/* Sheet */}
          <div
            ref={moreSheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="More sections"
            tabIndex={-1}
            className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl border-t border-border shadow-2xl pb-[env(safe-area-inset-bottom,0px)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-foreground/20" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-3">
              <span className="text-sm font-bold text-foreground">More</span>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="p-1.5 hover:bg-muted rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            {/* Tab grid */}
            <div className="grid grid-cols-4 gap-2 px-6 pb-6">
              {moreNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    navigateTo(item.id);
                    setMoreOpen(false);
                  }}
                  className={`${item.mobileOnly ? "md:hidden " : ""}flex flex-col items-center gap-2 p-3 border transition-colors ${
                    mode === item.id
                      ? "border-primary bg-muted/50"
                      : "border-transparent hover:border-border hover:bg-muted/30"
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/40">
                    <item.icon className={`w-5 h-5 ${mode === item.id ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <span className={`text-xs font-medium ${mode === item.id ? "text-foreground" : "text-muted-foreground"}`}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
            {/* Settings link */}
            <div className="border-t border-border px-6 py-3">
              <button
                onClick={() => {
                  navigateTo("settings");
                  setMoreOpen(false);
                }}
                className={`flex items-center gap-3 w-full py-2 transition-colors ${
                  mode === "settings" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <User className="w-5 h-5" />
                <span className="text-sm font-medium">Settings</span>
              </button>
            </div>
            {/* Power tools — agent chrome, secondary per ADR 0002 */}
            <div className="border-t border-border px-6 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50 mb-2">
                Power
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <AttestationBadge />
                <AgentWalletBadge />
                <EnhancedConnectButton className="flex" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
