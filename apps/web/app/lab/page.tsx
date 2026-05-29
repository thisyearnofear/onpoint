"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Palette,
  FlaskConical,
} from "lucide-react";
import { ThemeToggle } from "../../components/ThemeToggle";
import { NotificationBell } from "../../components/NotificationBell";
import { AgentWalletBadge } from "../../components/AgentWalletBadge";
import { Auth0HeaderButton } from "../../components/auth/Auth0Components";
import { TacticalDashboard } from "../../components/Dashboard/TacticalDashboard";

export default function LabPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Desktop Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-xl hidden md:block">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-accent shadow-md">
                <FlaskConical className="h-4 w-4 text-white" />
              </div>
              <span className="text-base font-bold tracking-tight">
                Lab
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
            </nav>
          </div>

          <div className="flex items-center gap-1">
            <NotificationBell />
            <AgentWalletBadge />
            <Auth0HeaderButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <div className="md:hidden sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 h-12">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            <Palette className="w-4 h-4" />
            <span className="font-medium">OnPoint</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <Auth0HeaderButton />
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* TacticalDashboard */}
      <TacticalDashboard onBack={() => window.history.back()} />
    </div>
  );
}
