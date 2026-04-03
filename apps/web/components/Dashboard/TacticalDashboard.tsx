"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette,
  Camera,
  MessageCircle,
  LayoutDashboard,
  Users,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Target,
  Clock,
  Video,
  Zap,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { logger } from "../../lib/utils/logger";
import { CommandCenter } from "./CommandCenter";
import { DesignStudio } from "../DesignStudio";
import { VirtualTryOn } from "../VirtualTryOn";
import { AIStylist } from "../AIStylist";
import { SocialFeed } from "../SocialFeed";
import { LiveStylistView } from "../VirtualTryOn/LiveStylistView";
import { AgentStatus } from "../Agent/AgentStatus";
import { AgentActionCard } from "../Agent/AgentActionCard";
import { MissionsPanel } from "../Agent/MissionsPanel";
import { NewUserOnboarding } from "./NewUserOnboarding";

type AppMode =
  | "dashboard"
  | "design"
  | "try-on"
  | "stylist"
  | "social"
  | "live-ar";

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
      label: "Virtual Try-On",
      icon: Camera,
      color: "text-accent",
    },
    {
      id: "stylist",
      label: "AI Stylist",
      icon: MessageCircle,
      color: "text-primary",
    },
    {
      id: "live-ar",
      label: "Live AR",
      icon: Video,
      color: "text-emerald-400",
    },
    {
      id: "design",
      label: "My Looks",
      icon: Palette,
      color: "text-indigo-400",
    },
    {
      id: "social",
      label: "Community",
      icon: Users,
      color: "text-blue-400",
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
            className="space-y-8"
          >
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-foreground tracking-tighter">
                Your Style Dashboard
              </h2>
              <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed">
                Find outfits that actually work for your body, style, and
                budget. BeOnPoint helps you decide faster with AI guidance,
                realistic try-on, and confidence before you buy.
              </p>
            </div>

            {/* Live AR Hero Banner - Key Differentiator */}
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
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/20 text-primary rounded-full uppercase tracking-wider animate-pulse">
                      ✨ New
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-foreground tracking-tight">
                    AI-Powered Virtual Try-On
                  </h3>
                  <p className="text-muted-foreground text-sm max-w-md">
                    See how any outfit looks on you before you buy. Upload a photo and get instant 
                    AI analysis of how clothes suit your body type and style.
                  </p>
                </div>
                <Button
                  onClick={() => setMode("try-on")}
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-primary/25 flex items-center gap-3"
                >
                  <Camera className="w-5 h-5" />
                  <span>Try It Now</span>
                </Button>
              </div>
            </motion.div>

            {/* Agent features - hidden behind progressive disclosure, not prominent */}
            {/* <AgentActionCard variant="banner" /> */}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <AgentStatus showActions={true} />
              <div className="lg:col-span-2 rounded-3xl border border-border bg-card/60 p-5 space-y-4">
                <div className="flex items-center gap-2 text-foreground">
                  <Target className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">
                    What we solve
                  </h3>
                </div>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span>
                      Stop guessing if an outfit will suit you before checkout.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span>
                      Get personalized style advice without booking a stylist
                      session.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span>
                      Save time by moving from inspiration to decision in
                      minutes.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="rounded-3xl border border-border bg-card/60 p-5 space-y-4">
                <div className="flex items-center gap-2 text-foreground">
                  <Clock className="w-4 h-4 text-accent" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">
                    How it works
                  </h3>
                </div>
                <ol className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-muted text-foreground text-[10px] font-bold grid place-items-center mt-0.5">
                      1
                    </span>
                    <span>
                      Upload a photo in{" "}
                      <strong className="text-foreground">
                        Virtual Try-On
                      </strong>{" "}
                      to preview fit and silhouette.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-muted text-foreground text-[10px] font-bold grid place-items-center mt-0.5">
                      2
                    </span>
                    <span>
                      Use{" "}
                      <strong className="text-foreground">AI Stylist</strong> to
                      get outfit recommendations for your event, vibe, and
                      budget.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-muted text-foreground text-[10px] font-bold grid place-items-center mt-0.5">
                      3
                    </span>
                    <span>
                      Save or mint your final look in{" "}
                      <strong className="text-foreground">Design Studio</strong>{" "}
                      and share with the community.
                    </span>
                  </li>
                </ol>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Command Center */}
              <CommandCenter />

              {/* Missions Panel */}
              <MissionsPanel userId="user-default" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Quick Actions */}
              <div className="rounded-3xl border border-border bg-card/60 p-5 space-y-4">
                <div className="flex items-center gap-2 text-foreground">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">
                    Quick Actions
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMode("try-on")}
                    className="text-xs"
                  >
                    Virtual Try-On
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMode("stylist")}
                    className="text-xs"
                  >
                    AI Stylist
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMode("design")}
                    className="text-xs"
                  >
                    Design Studio
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMode("social")}
                    className="text-xs"
                  >
                    Community
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <DashboardActionCard
                title="AI Design Studio"
                description="Create personalized looks and keep your best concepts in one place."
                icon={<Palette className="w-6 h-6 text-indigo-400" />}
                onClick={() => setMode("design")}
                buttonText="Open Design Studio"
              />
              <DashboardActionCard
                title="Talk to AI Stylist"
                description="Tell us your occasion and budget, then get practical outfit suggestions fast."
                icon={<MessageCircle className="w-6 h-6 text-primary" />}
                onClick={() => setMode("stylist")}
                buttonText="Chat Now"
              />
            </div>
          </motion.div>
        );
      case "design":
        return <DesignStudio />;
      case "try-on":
        return <VirtualTryOn />;
      case "live-ar":
        return (
          <div className="h-[calc(100vh-12rem)]">
            <ErrorBoundary
              onError={(error: Error) => {
                logger.error(
                  "LiveStylistView crashed",
                  { component: "LiveStylistView" },
                  error,
                );
              }}
            >
              <LiveStylistView onBack={() => setMode("dashboard")} />
            </ErrorBoundary>
          </div>
        );
      case "stylist":
        return <AIStylist />;
      case "social":
        return <SocialFeed />;
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
                <span className="text-sm font-medium">
                  {item.label}
                </span>
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

function DashboardActionCard({
  title,
  description,
  icon,
  onClick,
  buttonText,
  tag,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  buttonText: string;
  tag?: string;
}) {
  return (
    <div
      onClick={onClick}
      className="group relative p-6 rounded-3xl bg-card/60 border border-border hover:bg-card hover:border-border/80 transition-all cursor-pointer overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        {icon}
      </div>

      {tag && (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent/20 border border-accent/30 text-accent text-[8px] font-black uppercase tracking-widest mb-4">
          <Sparkles className="w-2.5 h-2.5" />
          {tag}
        </div>
      )}

      <div className="flex items-start gap-4">
        <div className="p-3 rounded-2xl bg-muted/50 ring-1 ring-border group-hover:ring-border/80 transition-all">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-foreground tracking-tight mb-1 group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="text-muted-foreground text-xs leading-relaxed max-w-xs">
            {description}
          </p>
          <button className="mt-3 text-[10px] uppercase tracking-widest font-bold text-primary/90 group-hover:text-primary transition-colors">
            {buttonText}
          </button>
        </div>
        <div className="self-center">
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-all transform group-hover:translate-x-1" />
        </div>
      </div>
    </div>
  );
}
