"use client";

import React, { useState, type ReactNode } from "react";
// framer-motion removed — using CSS transitions instead
import {
  Palette,
  Camera,
  MessageCircle,
  LayoutDashboard,
  Target,
  ShoppingBag,
  User,
  Image as ImageIcon,
} from "lucide-react";
import { NotificationBell } from "../NotificationBell";
import type { FashionItem } from "@onpoint/shared-types";
import {
  fashionItemToTryOnSelection,
  setPendingTryOnSelection,
} from "../../lib/utils/try-on-selection";

import { TryOnPanel } from "./TryOnPanel";
import { StylistPanel } from "./StylistPanel";
import { ShopPanel } from "./ShopPanel";
import { NewUserOnboarding } from "./NewUserOnboarding";
import { HomePanel } from "./HomePanel";
import { MyLooksPanel } from "./MyLooksPanel";
import { DesignPanel } from "./DesignPanel";
import { SettingsPanel } from "./SettingsPanel";

type AppMode = "dashboard" | "my-looks" | "try-on" | "stylist" | "shop" | "settings" | "design";

interface TacticalDashboardProps {
  onBack?: () => void;
}

export function TacticalDashboard({ onBack: _onBack }: TacticalDashboardProps) {
  // New users go straight to try-on. Returning users see dashboard.
  // NewUserOnboarding is a modal overlay that shows on first visit
  const [mode, setMode] = useState<AppMode>(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("onpoint-first-session-done")) {
      return "try-on";
    }
    return "dashboard";
  });

  // Deep-link context from storefront or external pages
  const [deepLinkContext, setDeepLinkContext] = React.useState<{
    from?: string;
    item?: string;
  } | null>(null);

  // Listen for URL tab param (e.g. from Connected Accounts nav link or storefront)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as AppMode | null;
    const from = params.get("from") || undefined;
    const item = params.get("item") || undefined;

    if (tab && ALL_MODES.includes(tab)) {
      setMode(tab);
      if (from || item) {
        setDeepLinkContext({ from, item });
      }
      // Clean the URL so bookmarking doesn't persist a transient tab
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  // All valid modes (for URL param validation)
  const ALL_MODES: AppMode[] = ["dashboard", "my-looks", "try-on", "stylist", "shop", "settings", "design"];

  // Desktop top-bar: full set of tabs
  const desktopNavItems = [
    { id: "dashboard" as AppMode, label: "Home", icon: LayoutDashboard, color: "text-foreground" },
    { id: "try-on" as AppMode, label: "Try On", icon: Camera, color: "text-accent" },
    { id: "stylist" as AppMode, label: "Stylist", icon: MessageCircle, color: "text-primary" },
    { id: "shop" as AppMode, label: "Shop", icon: ShoppingBag, color: "text-amber-400" },
    { id: "my-looks" as AppMode, label: "My Looks", icon: Palette, color: "text-indigo-400" },
    { id: "settings" as AppMode, label: "Settings", icon: Target, color: "text-muted-foreground" },
  ];

  // Mobile bottom nav: 4 core destinations
  const bottomNavItems = [
    { id: "dashboard" as AppMode, label: "Home", icon: LayoutDashboard },
    { id: "my-looks" as AppMode, label: "My Looks", icon: ImageIcon },
    // Try On is rendered as the elevated center button (not in this array)
    { id: "settings" as AppMode, label: "Settings", icon: User },
  ];

  // Route map — each mode maps to its content factory
  const contentMap: Record<AppMode, () => ReactNode> = {
    dashboard: () => <HomePanel onNavigate={(m) => setMode(m as AppMode)} />,
    "my-looks": () => <MyLooksPanel onNavigate={(m) => setMode(m as AppMode)} />,
    "design": () => <DesignPanel onNavigate={(m) => setMode(m as AppMode)} />,
    "try-on": () => <TryOnPanel
      deepLinkFrom={deepLinkContext?.from}
      deepLinkItem={deepLinkContext?.item}
      onDismissDeepLink={() => setDeepLinkContext(null)}
    />,
    stylist: () => <StylistPanel />,
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
      <NewUserOnboarding />
      <div className="flex flex-col min-h-screen bg-background">

      {/* ── Desktop top tab bar (hidden on mobile) ── */}
      <div className="hidden md:block sticky top-16 z-40 bg-background/80 backdrop-blur-md border-b border-border/60">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-1 py-3 overflow-x-auto no-scrollbar">
            {desktopNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all whitespace-nowrap ${
                  mode === item.id
                    ? "bg-muted text-foreground ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground/80"
                }`}
              >
                <item.icon className={`w-4 h-4 ${mode === item.id ? item.color : ""}`} />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1">
              <NotificationBell />
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
            <span className="text-[10px] font-medium">Home</span>
          </button>

          {/* My Looks */}
          <button
            onClick={() => navigateTo("my-looks")}
            className={`flex flex-col items-center gap-0.5 pt-2 pb-1 px-3 transition-colors ${
              mode === "my-looks" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <ImageIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium">My Looks</span>
          </button>

          {/* Try On — elevated center button */}
          <div className="flex flex-col items-center -mt-5">
            <button
              onClick={() => navigateTo("try-on")}
              className={`flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all ${
                mode === "try-on"
                  ? "bg-accent text-white shadow-accent/30 scale-95"
                  : "bg-primary text-white shadow-primary/25 hover:shadow-primary/40"
              }`}
            >
              <Camera className="w-6 h-6" />
            </button>
            <span className={`text-[10px] font-medium mt-0.5 ${mode === "try-on" ? "text-accent" : "text-muted-foreground"}`}>
              Try On
            </span>
          </div>

          {/* Settings */}
          <button
            onClick={() => navigateTo("settings")}
            className={`flex flex-col items-center gap-0.5 pt-2 pb-1 px-3 transition-colors ${
              mode === "settings" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium">Settings</span>
          </button>
        </div>
      </nav>
    </div>
    </>
  );
}
