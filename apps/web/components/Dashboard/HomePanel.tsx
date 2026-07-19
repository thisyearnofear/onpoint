"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  MessageCircle,
  Palette,
  ShoppingBag,
  Target,
  Wallet,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import { AgentActivityFeed } from "../Agent/AgentActivityFeed";
import { MissionsPanel } from "../Agent/MissionsPanel";
import { OnChainEconomics } from "./OnChainEconomics";
import { GStreakPill } from "../Curator/GStreakPill";
import { useGStreak } from "../../lib/hooks/use-g-streak";

interface HomePanelProps {
  onNavigate: (mode: string) => void;
}

export function HomePanel({ onNavigate }: HomePanelProps) {
  const { streak } = useGStreak();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
        {streak > 0 && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-warning/20 bg-warning/10 px-3 py-2">
            <Flame className={`h-4 w-4 ${streak >= 3 ? "text-warning" : "text-amber-400"}`} />
            <span className="text-sm font-bold text-warning dark:text-amber-400">{streak}</span>
            <span className="text-[10px] text-warning/70 dark:text-amber-400/70 whitespace-nowrap">
              G$ streak
            </span>
          </div>
        )}
        {[
          { label: "Try On", icon: Camera, mode: "try-on", color: "bg-accent/10 text-accent border-accent/20" },
          { label: "Shop", icon: ShoppingBag, mode: "shop", color: "bg-warning/10 text-warning border-warning/20" },
          { label: "Stylist", icon: MessageCircle, mode: "stylist", color: "bg-primary/10 text-primary border-primary/20" },
          { label: "My Looks", icon: Palette, mode: "my-looks", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
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
                Fit rail
              </span>
            </div>
            <h3 className="text-2xl font-black text-foreground tracking-tight">
              Try on, then shop real stock
            </h3>
            <p className="text-muted-foreground text-sm max-w-md">
              Upload a photo for a fit signal, then browse curator storefronts — WhatsApp/M-Pesa checkout, no wallet required.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => onNavigate("try-on")}
              className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-primary/25 flex items-center gap-3"
            >
              <Camera className="w-5 h-5" />
              <span>Start Try-On</span>
            </Button>
            <Button
              onClick={() => onNavigate("shop")}
              variant="outline"
              className="font-bold py-4 px-6 rounded-2xl"
            >
              <ShoppingBag className="w-5 h-5 mr-2" />
              Shop
            </Button>
          </div>
        </div>
      </motion.div>

      <GStreakPill />

      <details className="group rounded-2xl border border-border bg-card/40 overflow-hidden">
        <summary className="cursor-pointer p-4 flex items-center justify-between hover:bg-muted/30 transition-colors list-none">
          <div className="flex items-center gap-2 text-foreground">
            <Wallet className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-bold uppercase tracking-wider">
              Agent &amp; power tools
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-open:rotate-90 transition-transform" />
        </summary>
        <div className="px-4 pb-4 space-y-4 border-t border-border/60 pt-4">
          <p className="text-xs text-muted-foreground">
            Optional infrastructure for autonomous shopping — not required for try-on or WhatsApp checkout.
          </p>
          <AgentActivityFeed onShop={() => onNavigate("shop")} />
          <OnChainEconomics />
          <MissionsPanel userId="user-default" compact />
        </div>
      </details>

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
            <span>See fit before you buy — on real curator inventory.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>Checkout on WhatsApp / M-Pesa without a crypto wallet.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>Same catalog is reachable by shopping agents via API.</span>
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
            <span>Try on a listing with AI fit signal</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-muted text-foreground text-[10px] font-bold grid place-items-center mt-0.5">
              2
            </span>
            <span>Shop curator storefronts or Lab shop</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-muted text-foreground text-[10px] font-bold grid place-items-center mt-0.5">
              3
            </span>
            <span>Close on WhatsApp / M-Pesa — or let an agent buy</span>
          </li>
        </div>
      </details>
    </motion.div>
  );
}
