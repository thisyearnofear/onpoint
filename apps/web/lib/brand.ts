/**
 * Single source of truth for product naming and primary CTAs.
 * Vision: docs/STRATEGY.md — fit-aware supply graph, dual demand clients.
 */

export const PRODUCT_NAME = "OnPoint" as const;

/** Legal / domain display when BeOnPoint must appear (rare). Prefer PRODUCT_NAME. */
export const PRODUCT_NAME_LEGAL = "BeOnPoint" as const;

export const TAGLINE =
  "The fashion agent that earns permission to buy." as const;

export const TAGLINE_SHORT = "Earns permission to buy." as const;

export const META_DESCRIPTION =
  "OnPoint discovers live fashion, checks the fit, locks a binding quote, and requests exact-scope payment permission through Prava—then reports only what actually happened." as const;

/** Demand — human shop / try-on entry.
 * Phase 1: goes straight to the try-on lab with Nia pre-selected (fewest clicks to delight).
 * The /curators page remains as a browseable directory.
 * Phase 2: will become /try-on (dedicated fitting room page) when 2+ curators have try-on.
 * See: docs/STRATEGY.md → "Try-On Entry Point Rollout Strategy"
 */
export const CTA_SHOP = {
  href: "/#agent-search",
  label: "Try the live agent",
  mobileLabel: "Try the agent",
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
  eyebrow: "Agentic fashion commerce",
  headline: "The fashion agent that",
  headlineAccent: "earns permission to buy.",
  subcopy:
    "Search live products. Check the fit. Lock a binding quote. Then approve one merchant and one spending ceiling. OnPoint keeps the credential server-side and reports only what actually happened.",
} as const;
