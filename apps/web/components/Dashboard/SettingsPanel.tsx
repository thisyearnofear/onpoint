"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  ChevronRight,
  ShieldAlert,
  Target,
} from "lucide-react";
import { EnhancedConnectButton } from "../EnhancedConnectButton";
import { FarcasterSignInButton } from "../FarcasterSignInButton";
import { ConnectedAccounts } from "../ConnectedAccounts";
import { FraudMonitor } from "../FraudMonitor";
import { AuthAccountCTA } from "./AuthAccountCTA";

export function SettingsPanel() {
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
