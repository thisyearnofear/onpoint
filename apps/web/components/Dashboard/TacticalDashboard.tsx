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
} from "lucide-react";
import { Button } from "@repo/ui/button";
import { DesignStudio } from "../DesignStudio";
import { VirtualTryOn } from "../VirtualTryOn";
import { AIStylist } from "../AIStylist";
import { MissionsPanel } from "../Agent/MissionsPanel";
import { NewUserOnboarding } from "./NewUserOnboarding";
import { ConnectedAccounts } from "../ConnectedAccounts";
import { EnhancedConnectButton } from "../EnhancedConnectButton";
import { FarcasterSignInButton } from "../FarcasterSignInButton";

type AppMode = "dashboard" | "design" | "try-on" | "stylist" | "settings";

export function TacticalDashboard() {
  const [mode, setMode] = useState<AppMode>("dashboard");

  const navItems = [
    {
      id: "dashboard",
      label: "Home",
      icon: LayoutDashboard,
      color: "text-foreground",
    },
    {
      id: "try-on",
      label: "Try On",
      icon: Camera,
      color: "text-accent",
    },
    {
      id: "stylist",
      label: "Stylist",
      icon: MessageCircle,
      color: "text-primary",
    },
    {
      id: "design",
      label: "My Looks",
      icon: Palette,
      color: "text-indigo-400",
    },
    {
      id: "settings",
      label: "Settings",
      icon: Target,
      color: "text-muted-foreground",
    },
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

            {/* Secondary Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setMode("stylist")}
                className="h-auto py-4 flex flex-col items-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="text-sm">Chat with Stylist</span>
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setMode("design")}
                className="h-auto py-4 flex flex-col items-center gap-2"
              >
                <Palette className="w-5 h-5" />
                <span className="text-sm">My Saved Looks</span>
              </Button>
            </div>

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
      case "design":
        return <DesignStudio />;
      case "try-on":
        return <VirtualTryOn />;
      case "stylist":
        return <AIStylist />;
      case "settings":
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
                </p>
                <div className="flex flex-wrap gap-2">
                  <EnhancedConnectButton />
                  <FarcasterSignInButton />
                </div>
              </div>
            </details>

            <ConnectedAccounts />
          </motion.div>
        );
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-background">
      <NewUserOnboarding />
      {/* Dynamic Header/Mode Switcher */}
      <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-md border-b border-border/60 px-2 md:px-0">
        <div className="container mx-auto">
          <div className="flex items-center justify-between overflow-x-auto no-scrollbar py-3 gap-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setMode(item.id as AppMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all whitespace-nowrap ${
                  mode === item.id
                    ? "bg-muted text-foreground ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground/80"
                }`}
              >
                <item.icon
                  className={`w-4 h-4 ${mode === item.id ? item.color : ""}`}
                />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-8">
        <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
      </main>
    </div>
  );
}
