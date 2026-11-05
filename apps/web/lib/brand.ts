/**
 * Single source of truth for product naming and primary CTAs.
 * Vision: docs/STRATEGY.md — fit-aware supply graph, dual demand clients.
 */

export const PRODUCT_NAME = "OnPoint" as const;

/** Legal / domain display when BeOnPoint must appear (rare). Prefer PRODUCT_NAME. */
export const PRODUCT_NAME_LEGAL = "BeOnPoint" as const;

export const TAGLINE = "Get your fit judged." as const;

export const TAGLINE_SHORT = "Get your fit judged." as const;

export const META_DESCRIPTION =
  "Runway is a daily closet challenge: pick a judge, dress to the theme, get a score and a verdict worth sharing. OnPoint also powers agent-ready fashion commerce underneath." as const;

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

/** Consumer — Runway daily fit check (ADR 0023: consumer first). */
export const CTA_PLAY = {
  href: "/runway/play",
  label: "Play today's Runway",
  mobileLabel: "Play Runway",
} as const;

export const HERO = {
  eyebrow: "Runway · daily fit check",
  headline: "Get your fit",
  headlineAccent: "judged. Then post it.",
  subcopy:
    "Pick a judge. Dress to today's theme. Get a score, a verdict and a card worth sharing.",
} as const;
