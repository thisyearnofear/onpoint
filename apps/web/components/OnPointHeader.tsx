"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shirt } from "lucide-react";
import { PRODUCT_NAME } from "../lib/brand";
import { PRIMARY_NAV, FOOTER_LINKS, isNavActive } from "../lib/navigation";
import { NavigationLink } from "./NavigationLink";
import { Auth0HeaderButton } from "./auth/Auth0Components";
import { CartSlot } from "./Shop/CartDrawer";
import { MobileNavigation } from "./mobile-navigation";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";

const linkBase =
  "inline-flex min-h-[44px] items-center gap-1.5 text-sm rounded-full px-3 py-1.5 transition-colors";
const linkIdle = `${linkBase} text-muted-foreground hover:text-foreground hover:bg-muted/50`;
const linkActive = `${linkBase} font-bold text-foreground underline underline-offset-8 decoration-2 decoration-primary`;

export function OnPointHeader() {
  const pathname = usePathname() || "/";

  return (
    <>
      {/* Desktop header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background hidden lg:block">
        <div className="container flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold">
            <div className="rounded-lg border border-border p-1.5">
              <Shirt className="h-4 w-4 text-foreground" />
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
          </nav>

          <div className="flex items-center gap-1">
            <CartSlot />
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
            <div className="p-1 rounded-lg border border-border">
              <Shirt className="h-4 w-4 text-foreground" />
            </div>
            <span className="text-sm font-bold tracking-tight">
              {PRODUCT_NAME}
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <CartSlot />
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
          <div className="rounded-lg border border-border p-1">
            <Shirt className="h-3.5 w-3.5 text-foreground" />
          </div>
          {PRODUCT_NAME}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span>Earn permission. Report truth.</span>
        </div>
      </div>
    </footer>
  );
}
