"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FlaskConical,
  ChevronDown,
} from "lucide-react";
import { ThemeToggle } from "../../components/ThemeToggle";
import { NotificationBell } from "../../components/NotificationBell";
import { AgentWalletBadge } from "../../components/AgentWalletBadge";
import { AttestationBadge } from "../../components/AttestationBadge";
import { Auth0HeaderButton } from "../../components/auth/Auth0Components";
import { EnhancedConnectButton } from "../../components/EnhancedConnectButton";
import { TacticalDashboard } from "../../components/Dashboard/TacticalDashboard";
import { CTA_SHOP, CTA_SUPPLY, PRODUCT_NAME } from "../../lib/brand";

export default function LabPage() {
  const [powerOpen, setPowerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-xl hidden md:block">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-accent shadow-md">
                <FlaskConical className="h-4 w-4 text-white" />
              </div>
              <span className="text-base font-bold tracking-tight">
                {PRODUCT_NAME} Lab
              </span>
            </div>

            <nav className="flex items-center gap-1">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-muted/50"
              >
                <ArrowLeft className="w-4 h-4" />
                Home
              </Link>
              <Link
                href={CTA_SHOP.href}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-muted/50"
              >
                Shop
              </Link>
              <Link
                href={CTA_SUPPLY.href}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-muted/50"
              >
                Supply
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              type="button"
              onClick={() => setPowerOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              aria-expanded={powerOpen}
            >
              Power
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${powerOpen ? "rotate-180" : ""}`}
              />
            </button>
            {powerOpen && (
              <>
                <AttestationBadge />
                <AgentWalletBadge />
                <EnhancedConnectButton className="hidden lg:flex" />
              </>
            )}
            <Auth0HeaderButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="md:hidden sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 h-12">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">{PRODUCT_NAME}</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <button
              type="button"
              onClick={() => setPowerOpen((v) => !v)}
              className="rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:bg-muted/50"
            >
              Power
            </button>
            {powerOpen && (
              <>
                <AttestationBadge />
                <EnhancedConnectButton />
              </>
            )}
            <Auth0HeaderButton />
            <ThemeToggle />
          </div>
        </div>
      </div>

      <TacticalDashboard onBack={() => window.history.back()} />
    </div>
  );
}
