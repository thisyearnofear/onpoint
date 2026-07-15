/**
 * Single source of truth for product naming and primary CTAs.
 * Vision: docs/STRATEGY.md — fit-aware supply graph, dual demand clients.
 */

export const PRODUCT_NAME = "OnPoint" as const;

/** Legal / domain display when BeOnPoint must appear (rare). Prefer PRODUCT_NAME. */
export const PRODUCT_NAME_LEGAL = "BeOnPoint" as const;

export const TAGLINE = "Fit before you buy — for people and agents." as const;

export const TAGLINE_SHORT = "Fit before you buy." as const;

export const META_DESCRIPTION =
  "OnPoint is the execution layer for fashion intent that needs fit, real stock, and local pay. Humans try on and check out via WhatsApp/M-Pesa; agents use the same inventory via API." as const;

/** Demand — human shop / try-on entry.
 * Phase 1: goes straight to the try-on lab with Nia pre-selected (fewest clicks to delight).
 * The /curators page remains as a browseable directory.
 * Phase 2: will become /try-on (dedicated fitting room page) when 2+ curators have try-on.
 * See: docs/STRATEGY.md → "Try-On Entry Point Rollout Strategy"
 */
export const CTA_SHOP = {
  href: "/lab?tab=try-on&from=nia",
  label: "Try on & shop",
  mobileLabel: "Try on & shop",
} as const;

/** Supply — curator acquisition. */
export const CTA_SUPPLY = {
  href: "/curator",
  label: "Add your inventory",
  onboardHref: "/curator/onboard",
  onboardLabel: "Create storefront",
} as const;

/** Power-user / own-agent tooling — never the primary marketing CTA. */
export const CTA_LAB = {
  href: "/lab",
  label: "Lab",
} as const;

export const HERO = {
  eyebrow: "Fit-aware fashion commerce",
  headline: "Fit before you buy.",
  headlineAccent: "Same catalog for people and agents.",
  subcopy:
    "Try on real inventory with AI, then buy on WhatsApp/M-Pesa — or let agents hit the same stock via API. Curators supply the graph.",
} as const;
