"use client";

import React, { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { CardEnhanced, EngagementBadge, ShopGrid, TransitionLink } from "@repo/shared-ui";
import type { FashionItem } from "@onpoint/shared-types";
import { FashionCategory } from "@onpoint/shared-types";
import { Button } from "@repo/ui/button";
import { Badge } from "@repo/ui/badge";
import { OnPointLayout } from "../../components/OnPointLayout";

const MOCK_ITEMS: FashionItem[] = [
  {
    id: "1",
    slug: "urban-jacket",
    name: "Urban Streetwear Jacket",
    description: "High-fashion streetwear jacket with reflective material",
    cover: "/assets/1Product.png",
    modelSrc: "/assets/1Model.png",
    category: FashionCategory.Outerwear,
    price: 129.99,
    tryOnCount: 1250,
    mintCount: 42,
    averageRating: 4.7,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    slug: "designer-sneakers",
    name: "Designer Sneakers",
    description: "Limited edition sneakers with unique color blocking",
    cover: "/assets/2Product.png",
    modelSrc: "/assets/2Model.png",
    category: FashionCategory.Shoes,
    price: 249.99,
    tryOnCount: 890,
    mintCount: 28,
    averageRating: 4.5,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "3",
    slug: "statement-necklace",
    name: "Statement Necklace",
    description: "Bold accessories with metallic finishes",
    cover: "/assets/3Product.png",
    modelSrc: "/assets/3Model.png",
    category: FashionCategory.Accessories,
    price: 79.99,
    tryOnCount: 340,
    mintCount: 15,
    averageRating: 4.2,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  if (!mounted) return null;

  return (
    <button
      onClick={toggle}
      className="fixed top-4 right-4 z-50 p-3 rounded-full bg-card border border-border shadow-lg hover:shadow-xl transition-all duration-200 group"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-amber-400 group-hover:scale-110 transition-transform" />
      ) : (
        <Moon className="h-5 w-5 text-muted-foreground group-hover:scale-110 transition-transform" />
      )}
    </button>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-foreground">{children}</h2>
      <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-2" />
    </div>
  );
}

function VariantLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
      {children}
    </span>
  );
}

export default function StyleGuidePage() {
  const [liked, setLiked] = useState<Set<string>>(new Set());

  return (
    <OnPointLayout footer={false}>
      <ThemeToggle />

      <div className="container mx-auto px-4 py-12 space-y-20">
        {/* ===== Colors ===== */}
        <section>
          <SectionHeading>Theme Colors</SectionHeading>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              { name: "Background", var: "--background", class: "bg-background border" },
              { name: "Foreground", var: "--foreground", class: "bg-foreground" },
              { name: "Card", var: "--card", class: "bg-card border" },
              { name: "Primary", var: "--primary", class: "bg-primary" },
              { name: "Secondary", var: "--secondary", class: "bg-secondary" },
              { name: "Accent", var: "--accent", class: "bg-accent" },
              { name: "Muted", var: "--muted", class: "bg-muted" },
              { name: "Destructive", var: "--destructive", class: "bg-destructive" },
              { name: "Border", var: "--border", class: "bg-border" },
              { name: "Input", var: "--input", class: "bg-input" },
              { name: "Ring", var: "--ring", class: "bg-ring" },
            ].map((c) => (
              <div key={c.name} className="space-y-2">
                <div className={`h-16 rounded-lg ${c.class} border-border/20`} />
                <div className="text-xs">
                  <p className="font-medium text-foreground">{c.name}</p>
                  <code className="text-muted-foreground">{c.var}</code>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== EngagementBadge ===== */}
        <section>
          <SectionHeading>EngagementBadge</SectionHeading>

          <div className="space-y-8">
            {/* Full variants */}
            <div>
              <VariantLabel>Full — All Types</VariantLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EngagementBadge type="trending" tryOnCount={1250} rating={4.7} mintCount={42} animated />
                <EngagementBadge type="viral" tryOnCount={3400} rating={4.9} mintCount={128} animated />
                <EngagementBadge type="popular" tryOnCount={890} rating={4.5} mintCount={56} animated />
                <EngagementBadge type="new" tryOnCount={150} mintCount={5} animated />
              </div>
            </div>

            {/* Compact variants */}
            <div>
              <VariantLabel>Compact</VariantLabel>
              <div className="flex flex-wrap gap-3">
                <EngagementBadge type="trending" tryOnCount={1250} compact />
                <EngagementBadge type="viral" tryOnCount={3400} compact />
                <EngagementBadge type="popular" tryOnCount={890} compact />
                <EngagementBadge type="new" tryOnCount={150} compact />
              </div>
            </div>
          </div>
        </section>

        {/* ===== CardEnhanced ===== */}
        <section>
          <SectionHeading>CardEnhanced</SectionHeading>

          <div className="space-y-8">
            <div>
              <VariantLabel>Enhanced Variant</VariantLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {MOCK_ITEMS.map((item) => (
                  <CardEnhanced
                    key={item.id}
                    item={item}
                    variant="enhanced"
                    showStats
                    showActions
                    onLike={(liked) => {
                      setLiked((prev) => {
                        const next = new Set(prev);
                        liked ? next.add(item.id) : next.delete(item.id);
                        return next;
                      });
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <VariantLabel>Basic Variant</VariantLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {MOCK_ITEMS.map((item) => (
                  <CardEnhanced
                    key={item.id}
                    item={item}
                    variant="basic"
                    showStats={false}
                    showActions={false}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ===== ShopGrid ===== */}
        <section>
          <SectionHeading>ShopGrid</SectionHeading>
          <VariantLabel>Carousel mode (mobile) + Filterable Grid</VariantLabel>
          <div className="border border-border rounded-xl p-4 bg-card/30">
            <ShopGrid
              items={MOCK_ITEMS}
              showFilters
              showStats
              enableMobileCarousel
            />
          </div>
        </section>

        {/* ===== TransitionLink ===== */}
        <section>
          <SectionHeading>TransitionLink</SectionHeading>
          <VariantLabel>Links with view transition metadata (requires item prop)</VariantLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {MOCK_ITEMS.map((item) => (
              <TransitionLink key={item.id} href={`/item/${item.slug}`} item={item} className="block p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors">
                <p className="text-sm font-medium text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground mt-1">View →</p>
              </TransitionLink>
            ))}
          </div>
        </section>

        {/* ===== Tailwind UI Primitives ===== */}
        <section>
          <SectionHeading>UI Primitives</SectionHeading>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <VariantLabel>Buttons</VariantLabel>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button variant="default">Default</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm">Small</Button>
                  <Button size="default">Default</Button>
                  <Button size="lg">Large</Button>
                </div>
                <div>
                  <Button disabled>Disabled</Button>
                </div>
              </div>
            </div>

            <div>
              <VariantLabel>Badges</VariantLabel>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Glass & Gradient Utilities ===== */}
        <section>
          <SectionHeading>Design Utilities</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="glass-effect rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-2">Glass Effect</h3>
              <p className="text-sm text-muted-foreground">Backdrop blur with themed background</p>
            </div>
            <div className="fashion-gradient rounded-xl p-6">
              <h3 className="font-semibold text-white mb-2">Fashion Gradient</h3>
              <p className="text-sm text-white/80">Primary to accent gradient</p>
            </div>
            <div className="elegant-shadow rounded-xl p-6 bg-card border border-border">
              <h3 className="font-semibold text-foreground mb-2">Elegant Shadow</h3>
              <p className="text-sm text-muted-foreground">Primary-tinted shadow</p>
            </div>
          </div>
        </section>

        {/* ===== Animated utilities preview ===== */}
        <section>
          <SectionHeading>Animations</SectionHeading>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { name: "Bounce In Up", class: "animate-bounce-in-up" },
              { name: "Float", class: "animate-float" },
              { name: "Scale Pulse", class: "animate-scale-pulse" },
              { name: "Swipe Left", class: "animate-swipe-in-left" },
            ].map((anim) => (
              <div
                key={anim.name}
                className={`${anim.class} p-4 rounded-lg bg-card border border-border text-center`}
              >
                <p className="text-sm font-medium text-foreground">{anim.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{anim.class}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div className="text-center py-8 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Toggle the theme button (top-right) to verify dark mode compatibility.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Components from <code className="text-primary">@repo/shared-ui</code>,{" "}
            <code className="text-primary">@repo/ui</code>
          </p>
        </div>
      </div>
    </OnPointLayout>
  );
}
