"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette,
  Camera,
  MessageCircle,
  LayoutDashboard,
  ChevronRight,
  CheckCircle2,
  Target,
  Clock,
  ShoppingBag,
  ShieldAlert,
  Crown,
  User,
  Image as ImageIcon,
} from "lucide-react";
import { NotificationBell } from "../NotificationBell";
import { PolaroidGallery } from "../PolaroidGallery";
import Link from "next/link";
import { Button } from "@repo/ui/button";
import { DesignStudio } from "../DesignStudio";
import { VirtualTryOn } from "../VirtualTryOn";
import { AIStylist } from "../AIStylist";
import { MissionsPanel } from "../Agent/MissionsPanel";
import { ConnectedAccounts } from "../ConnectedAccounts";
import { EnhancedConnectButton } from "../EnhancedConnectButton";
import { FarcasterSignInButton } from "../FarcasterSignInButton";
import { useUser } from "@auth0/nextjs-auth0/client";
import { InlineShop } from "../Shop/InlineShop";
import { AgentActivityFeed } from "../Agent/AgentActivityFeed";
import { FraudMonitor } from "../FraudMonitor";
import { NewUserOnboarding } from "./NewUserOnboarding";

type AppMode = "dashboard" | "my-looks" | "try-on" | "stylist" | "shop" | "profile" | "design";

function AuthAccountCTA() {
  const { user, isLoading } = useUser();
  if (isLoading || user) return null;
  return (
    <p className="text-xs text-muted-foreground">
      <a href="/auth/login" className="underline underline-offset-2 text-primary">Sign in</a>
      {" "}to save looks, track orders, and connect external accounts.
    </p>
  );
}

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

  // Listen for URL tab param (e.g. from Connected Accounts nav link on another page)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as AppMode | null;
    if (tab && ALL_MODES.includes(tab)) {
      setMode(tab);
      // Clean the URL so bookmarking doesn't persist a transient tab
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  // All valid modes (for URL param validation)
  const ALL_MODES: AppMode[] = ["dashboard", "my-looks", "try-on", "stylist", "shop", "profile", "design"];

  // Desktop top-bar: full set of tabs
  const desktopNavItems = [
    { id: "dashboard" as AppMode, label: "Home", icon: LayoutDashboard, color: "text-foreground" },
    { id: "try-on" as AppMode, label: "Try On", icon: Camera, color: "text-accent" },
    { id: "stylist" as AppMode, label: "Stylist", icon: MessageCircle, color: "text-primary" },
    { id: "shop" as AppMode, label: "Shop", icon: ShoppingBag, color: "text-amber-400" },
    { id: "my-looks" as AppMode, label: "My Looks", icon: Palette, color: "text-indigo-400" },
    { id: "profile" as AppMode, label: "Profile", icon: Target, color: "text-muted-foreground" },
  ];

  // Mobile bottom nav: 4 core destinations
  const bottomNavItems = [
    { id: "dashboard" as AppMode, label: "Home", icon: LayoutDashboard },
    { id: "my-looks" as AppMode, label: "My Looks", icon: ImageIcon },
    // Try On is rendered as the elevated center button (not in this array)
    { id: "profile" as AppMode, label: "Profile", icon: User },
  ];

  const renderContent = () => {
    switch (mode) {
      case "dashboard":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Quick Actions — horizontal scroll on mobile */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
              {[
                { label: "Try On", icon: Camera, mode: "try-on" as AppMode, color: "bg-accent/10 text-accent border-accent/20" },
                { label: "Stylist", icon: MessageCircle, mode: "stylist" as AppMode, color: "bg-primary/10 text-primary border-primary/20" },
                { label: "Shop", icon: ShoppingBag, mode: "shop" as AppMode, color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
                { label: "My Looks", icon: Palette, mode: "my-looks" as AppMode, color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
              ].map((action) => (
                <button
                  key={action.mode}
                  onClick={() => setMode(action.mode)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-medium whitespace-nowrap transition-all active:scale-95 ${action.color}`}
                >
                  <action.icon className="w-4 h-4" />
                  {action.label}
                </button>
              ))}
            </div>

            {/* Primary CTA - Virtual Try-On */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 border border-primary/20 p-6 md:p-8"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-3xl rounded-full -mr-32 -mt-32" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/10 blur-3xl rounded-full -ml-24 -mb-24" />

              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/20 text-primary rounded-full uppercase tracking-wider">
                      ✨ Start Here
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-foreground tracking-tight">
                    Upload a Photo, Get Your Look
                  </h3>
                  <p className="text-muted-foreground text-sm max-w-md">
                    AI analyzes your fit, recommends styles, and shops for you with its wallet.
                  </p>
                </div>
                <Button
                  onClick={() => setMode("try-on")}
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-primary/25 flex items-center gap-3"
                >
                  <Camera className="w-5 h-5" />
                  <span>Start Try-On</span>
                </Button>
              </div>
            </motion.div>

            {/* Agent Activity — persistent across sessions */}
            <AgentActivityFeed onShop={() => setMode("shop")} />

            {/* Progressive Disclosure - Collapsible Sections */}
            <details
              className="group rounded-2xl border border-border bg-card/40 overflow-hidden"
              open
            >
              <summary className="cursor-pointer p-4 flex items-center justify-between hover:bg-muted/30 transition-colors list-none">
                <div className="flex items-center gap-2 text-foreground">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold uppercase tracking-wider">
                    What we solve
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-4 pb-4 space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  <span>
                    Stop guessing if an outfit will suit you before checkout.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  <span>
                    Get personalized style advice without a stylist session.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  <span>Move from inspiration to decision in minutes.</span>
                </li>
              </div>
            </details>

            <details className="group rounded-2xl border border-border bg-card/40 overflow-hidden">
              <summary className="cursor-pointer p-4 flex items-center justify-between hover:bg-muted/30 transition-colors list-none">
                <div className="flex items-center gap-2 text-foreground">
                  <Clock className="w-4 h-4 text-accent" />
                  <span className="text-sm font-bold uppercase tracking-wider">
                    How it works
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-4 pb-4 space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-muted text-foreground text-[10px] font-bold grid place-items-center mt-0.5">
                    1
                  </span>
                  <span>Upload a photo to preview fit</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-muted text-foreground text-[10px] font-bold grid place-items-center mt-0.5">
                    2
                  </span>
                  <span>Get AI recommendations for your event & budget</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-muted text-foreground text-[10px] font-bold grid place-items-center mt-0.5">
                    3
                  </span>
                  <span>Save or share your look</span>
                </li>
              </div>
            </details>

            {/* Progress - Simple compact view */}
            <MissionsPanel userId="user-default" compact />
          </motion.div>
        );
      case "my-looks":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <PolaroidGallery
              onNavigateToTryOn={() => setMode("try-on")}
              onNavigateToDesign={() => setMode("design")}
            />
          </motion.div>
        );
      case "design":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="mb-4">
              <button
                onClick={() => setMode("my-looks")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                &larr; Back to My Looks
              </button>
            </div>
            <DesignStudio />
          </motion.div>
        );
      case "try-on":
        return <VirtualTryOn />;
      case "stylist":
        return <AIStylist />;
      case "shop":
        return <InlineShop onTryOn={() => setMode("try-on")} />;
      case "profile":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div>
              <h2 className="text-2xl font-bold mb-2">Settings</h2>
              <p className="text-muted-foreground">
                Manage your accounts and preferences
              </p>
            </div>

            {/* Wallet & Social — progressive disclosure */}
            <details className="group rounded-2xl border border-border bg-card/40 overflow-hidden" open>
              <summary className="cursor-pointer p-4 flex items-center justify-between hover:bg-muted/30 transition-colors list-none">
                <div className="flex items-center gap-2 text-foreground">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold uppercase tracking-wider">
                    Wallet & Social
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-4 pb-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Connect a wallet to unlock purchases, tipping, and saving looks on-chain.
                  Your wallet and your app account are separate — connect both for the full experience.
                </p>
                <div className="flex flex-wrap gap-2">
                  <EnhancedConnectButton />
                  <FarcasterSignInButton />
                </div>
                <AuthAccountCTA />
              </div>
            </details>

            <ConnectedAccounts />

            {/* Subscription Management */}
            <details className="group rounded-2xl border border-border bg-card/40 overflow-hidden" open>
              <summary className="cursor-pointer p-4 flex items-center justify-between hover:bg-muted/30 transition-colors list-none">
                <div className="flex items-center gap-2 text-foreground">
                  <Crown className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold uppercase tracking-wider">
                    Subscription
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-4 pb-4">
                <p className="text-xs text-muted-foreground mb-3">
                  View your current plan, track usage, compare tiers, and manage billing.
                </p>
                <Link href="/account/subscription">
                  <Button variant="outline" size="sm" className="w-full">
                    <Crown className="w-3.5 h-3.5 mr-2" />
                    Manage Subscription
                  </Button>
                </Link>
              </div>
            </details>

            {/* Fraud Monitoring Dashboard */}
            <details className="group rounded-2xl border border-border bg-card/40 overflow-hidden">
              <summary className="cursor-pointer p-4 flex items-center justify-between hover:bg-muted/30 transition-colors list-none">
                <div className="flex items-center gap-2 text-foreground">
                  <ShieldAlert className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold uppercase tracking-wider">
                    Agent Security & Monitoring
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-4 pb-4">
                <p className="text-xs text-muted-foreground mb-3">
                  Real-time monitoring for autonomous agent spending. Tracks anomalies,
                  heartbeat health, and suspicious patterns.
                </p>
                <FraudMonitor />
              </div>
            </details>
          </motion.div>
        );
    }
  };

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
        <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
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

          {/* Profile */}
          <button
            onClick={() => navigateTo("profile")}
            className={`flex flex-col items-center gap-0.5 pt-2 pb-1 px-3 transition-colors ${
              mode === "profile" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium">Profile</span>
          </button>
        </div>
      </nav>
    </div>
    </>
  );
}
