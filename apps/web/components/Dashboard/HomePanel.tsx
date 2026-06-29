"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  Globe,
  MessageCircle,
  Palette,
  Radar,
  ShoppingBag,
  Target,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import { AgentActivityFeed } from "../Agent/AgentActivityFeed";
import { MissionsPanel } from "../Agent/MissionsPanel";
import { OnChainEconomics } from "./OnChainEconomics";

const STREAK_KEY = "onpoint-streak";
const VISIT_DATE_KEY = "onpoint-last-visit-date";

function useStreak() {
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    try {
      const today = new Date().toDateString();
      const lastVisit = localStorage.getItem(VISIT_DATE_KEY);
      const savedStreak = parseInt(localStorage.getItem(STREAK_KEY) || "0", 10);

      if (lastVisit === today) {
        // Already counted today
        setStreak(savedStreak);
        return;
      }

      const yesterday = new Date(Date.now() - 86400000).toDateString();

      if (lastVisit === yesterday) {
        // Consecutive day
        const newStreak = savedStreak + 1;
        localStorage.setItem(STREAK_KEY, String(newStreak));
        localStorage.setItem(VISIT_DATE_KEY, today);
        setStreak(newStreak);
      } else if (!lastVisit) {
        // First ever visit
        localStorage.setItem(STREAK_KEY, "1");
        localStorage.setItem(VISIT_DATE_KEY, today);
        setStreak(1);
      } else {
        // Streak broken — more than 1 day gap
        localStorage.setItem(STREAK_KEY, "1");
        localStorage.setItem(VISIT_DATE_KEY, today);
        setStreak(1);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  return streak;
}

interface HomePanelProps {
  onNavigate: (mode: string) => void;
}

export function HomePanel({ onNavigate }: HomePanelProps) {
  const streak = useStreak();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Quick Actions + Streak badge */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
        {streak > 0 && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-2">
            <Flame className={`h-4 w-4 ${streak >= 3 ? "text-amber-500" : "text-amber-400"}`} />
            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{streak}</span>
            <span className="text-[10px] text-amber-600/70 dark:text-amber-400/70 whitespace-nowrap">
              day streak
            </span>
          </div>
        )}
        {[
          { label: "Try On", icon: Camera, mode: "try-on", color: "bg-accent/10 text-accent border-accent/20" },
          { label: "Stylist", icon: MessageCircle, mode: "stylist", color: "bg-primary/10 text-primary border-primary/20" },
          { label: "Shop", icon: ShoppingBag, mode: "shop", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
          { label: "Market Intel", icon: Radar, mode: "intel", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
          { label: "My Looks", icon: Palette, mode: "my-looks", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
          { label: "Community", icon: Globe, mode: "community", color: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
        ].map((action) => (
          <button
            key={action.mode}
            onClick={() => onNavigate(action.mode)}
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
            onClick={() => onNavigate("try-on")}
            className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-primary/25 flex items-center gap-3"
          >
            <Camera className="w-5 h-5" />
            <span>Start Try-On</span>
          </Button>
        </div>
      </motion.div>

      {/* Agent Activity — persistent across sessions */}
      <AgentActivityFeed onShop={() => onNavigate("shop")} />

      {/* On-Chain Economics — sub-cent tx cost proof */}
      <OnChainEconomics />

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
}
