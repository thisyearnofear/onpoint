"use client";

import Link from "next/link";
import {
  Camera,
  Palette,
  Store,
  DollarSign,
  BookOpen,
  Info,
  Sparkles,
} from "lucide-react";
import { PRODUCT_NAME, CTA_SHOP } from "../lib/brand";
import { Auth0HeaderButton } from "./auth/Auth0Components";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";

export function OnPointHeader() {
  return (
    <>
      {/* Desktop header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-xl hidden md:block">
        <div className="container flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold">
            <div className="rounded-lg bg-gradient-to-br from-primary to-accent p-1.5 shadow-md">
              <Palette className="h-4 w-4 text-white" />
            </div>
            {PRODUCT_NAME}
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              href={CTA_SHOP.href}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 px-3 py-1.5 rounded-full transition-colors"
            >
              <Camera className="w-4 h-4" />
              Shop
            </Link>
            <Link
              href="/looks"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 px-3 py-1.5 rounded-full transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Looks
            </Link>
            <Link
              href="/curator"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 px-3 py-1.5 rounded-full transition-colors"
            >
              <Store className="w-4 h-4" />
              Supply
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 px-3 py-1.5 rounded-full transition-colors"
            >
              <DollarSign className="w-4 h-4" />
              Pricing
            </Link>
            <Link
              href="/developers"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 px-3 py-1.5 rounded-full transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              Developers
            </Link>
            <Link
              href="/guides"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 px-3 py-1.5 rounded-full transition-colors"
            >
              Guides
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 px-3 py-1.5 rounded-full transition-colors"
            >
              <Info className="w-4 h-4" />
              About
            </Link>
          </nav>

          <div className="flex items-center gap-1">
            <NotificationBell />
            <Auth0HeaderButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Mobile header */}
      <div className="md:hidden sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 h-12">
          <Link href="/" className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-gradient-to-br from-primary to-accent shadow-sm">
              <Palette className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight">{PRODUCT_NAME}</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href={CTA_SHOP.href}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary px-2 py-1 rounded-full bg-primary/10 hover:bg-primary/15 transition-colors"
            >
              <Camera className="w-3 h-3" />
              Shop
            </Link>
            <Link
              href="/looks"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground px-2 py-1 rounded-full hover:bg-muted/50 transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              Looks
            </Link>
            <Link
              href="/curator"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground px-2 py-1 rounded-full hover:bg-muted/50 transition-colors"
            >
              <Store className="w-3 h-3" />
              Supply
            </Link>
            <NotificationBell direction="up" />
            <Auth0HeaderButton />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </>
  );
}

export function OnPointFooter() {
  return (
    <footer className="border-t border-border/60 py-8">
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-gradient-to-br from-primary to-accent p-1 shadow-md">
            <Palette className="h-3.5 w-3.5 text-white" />
          </div>
          {PRODUCT_NAME}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href={CTA_SHOP.href} className="hover:text-foreground transition-colors">
            Shop
          </Link>
          <Link href="/looks" className="hover:text-foreground transition-colors">
            Looks
          </Link>
          <Link href="/curator" className="hover:text-foreground transition-colors">
            Supply
          </Link>
          <Link href="/pricing" className="hover:text-foreground transition-colors">
            Pricing
          </Link>
          <Link href="/developers" className="hover:text-foreground transition-colors">
            Developers
          </Link>
          <Link href="/guides" className="hover:text-foreground transition-colors">
            Guides
          </Link>
          <Link href="/about" className="hover:text-foreground transition-colors">
            About
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span>Fit before you buy.</span>
        </div>
      </div>
    </footer>
  );
}
