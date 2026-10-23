"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  Camera,
  Sparkles,
  Store,
  DollarSign,
  BookOpen,
  Info,
  Shirt,
} from "lucide-react";
import { CTA_SHOP } from "../lib/brand";

const MOBILE_LINKS = [
  { href: "/runway", label: "Runway", icon: Shirt, isNew: true },
  { href: CTA_SHOP.href, label: "Shop", icon: Camera },
  { href: "/looks", label: "Looks", icon: Sparkles },
  { href: "/curator", label: "Supply", icon: Store },
  { href: "/pricing", label: "Pricing", icon: DollarSign },
  { href: "/developers", label: "Developers", icon: BookOpen },
  { href: "/guides", label: "Guides", icon: BookOpen },
  { href: "/about", label: "About", icon: Info },
];

/**
 * Mobile-only hamburger menu. Rendered inside the mobile header in
 * OnPointHeader (hidden on md+ via the header's own `md:hidden` wrapper).
 * Mirrors the desktop nav links.
 */
export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50 active:scale-[0.98] transition-[background-color,transform]"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 top-14 z-40 bg-background/95 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <nav
            className="flex flex-col gap-1 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {MOBILE_LINKS.map(({ href, label, icon: Icon, isNew }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium text-foreground hover:bg-muted/60 active:bg-muted transition-colors"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                {label}
                {isNew && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="New" />
                )}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
