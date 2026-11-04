"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Palette, ChevronDown } from "lucide-react";
import { PRODUCT_NAME, CTA_PLAY, CTA_SHOP } from "../lib/brand";
import { PRIMARY_NAV, SECONDARY_NAV, isNavActive } from "../lib/navigation";
import { NavigationLink } from "./NavigationLink";
import { Auth0HeaderButton } from "./auth/Auth0Components";
import { MobileNavigation } from "./mobile-navigation";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";

const linkBase =
  "inline-flex min-h-[44px] items-center gap-1.5 text-sm rounded-full px-3 py-1.5 transition-colors";
const linkIdle = `${linkBase} text-muted-foreground hover:text-foreground hover:bg-muted/50`;
const linkActive = `${linkBase} font-bold text-foreground underline underline-offset-8 decoration-2 decoration-primary`;

export function OnPointHeader() {
  const pathname = usePathname() || "/";
  const moreRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    const details = moreRef.current;
    if (!details) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && details.open) {
        details.open = false;
        details.querySelector("summary")?.focus();
      }
    };
    const onPointer = (e: Event) => {
      if (details.open && !details.contains(e.target as Node)) details.open = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  return (
    <>
      {/* Desktop header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background hidden lg:block">
        <div className="container flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold">
            <div className="rounded-lg bg-gradient-to-br from-primary to-accent p-1.5 shadow-md">
              <Palette className="h-4 w-4 text-white" />
            </div>
            {PRODUCT_NAME}
          </Link>

          <nav className="flex items-center gap-1" aria-label="Primary">
            {PRIMARY_NAV.map((item) => (
              <NavigationLink
                key={item.href}
                href={item.href}
                label={item.label}
                aria-current={isNavActive(item.href, pathname) ? "page" : undefined}
                className={isNavActive(item.href, pathname) ? linkActive : linkIdle}
              >
                {item.label}
              </NavigationLink>
            ))}
            <details ref={moreRef} className="group relative">
              <summary className={`${linkIdle} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
                More <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </summary>
              <div className="absolute right-0 top-full mt-1 min-w-44 rounded-xl border border-border/60 bg-popover p-1 shadow-lg">
                {SECONDARY_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => { if (moreRef.current) moreRef.current.open = false; }}
                    className="flex min-h-[44px] items-center rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </details>
          </nav>

          <div className="flex items-center gap-1">
            <NavigationLink
              href={CTA_PLAY.href}
              label="Runway"
              className="mr-1 inline-flex min-h-9 items-center rounded-full bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary/90"
            >
              Play
            </NavigationLink>
            <NotificationBell />
            <Auth0HeaderButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Mobile header */}
      <div className="lg:hidden sticky top-0 z-50 w-full border-b border-border/60 bg-background">
        <div className="flex items-center justify-between px-3 h-14">
          <Link href="/" className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-gradient-to-br from-primary to-accent shadow-sm">
              <Palette className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight">
              {PRODUCT_NAME}
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <NavigationLink
              href={CTA_PLAY.href}
              label="Runway"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-semibold text-white hover:bg-primary/90 active:scale-[0.98] transition-[background-color,transform]"
            >
              Play
            </NavigationLink>
            <div className="hidden sm:contents">
              <NotificationBell direction="up" />
              <Auth0HeaderButton />
            </div>
            <ThemeToggle />
            <MobileNavigation />
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
          <Link
            href={CTA_SHOP.href}
            className="hover:text-foreground transition-colors"
          >
            Live agent
          </Link>
          <Link
            href="/looks"
            className="hover:text-foreground transition-colors"
          >
            Looks
          </Link>
          <Link
            href="/curator"
            className="hover:text-foreground transition-colors"
          >
            Supply
          </Link>
          <Link
            href="/pricing"
            className="hover:text-foreground transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/developers"
            className="hover:text-foreground transition-colors"
          >
            Developers
          </Link>
          <Link
            href="/guides"
            className="hover:text-foreground transition-colors"
          >
            Guides
          </Link>
          <Link
            href="/about"
            className="hover:text-foreground transition-colors"
          >
            About
          </Link>
          <Link
            href="/privacy"
            className="hover:text-foreground transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="hover:text-foreground transition-colors"
          >
            Terms
          </Link>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span>Earn permission. Report truth.</span>
        </div>
      </div>
    </footer>
  );
}
