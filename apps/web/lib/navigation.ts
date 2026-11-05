export interface NavItem {
  href: string;
  label: string;
}

/**
 * Places, not flows — three of them. Purchase, styling and saved renders are
 * actions attached to the artifact they act on, so they have no door here
 * (ADR 0028). Nothing else may join this list without dropping something.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Wardrobe" },
  { href: "/runway", label: "Runway" },
  { href: "/lab/try-on", label: "Fitting room" },
];

/**
 * Non-consumer destinations. Nav is for places a shopper returns to; these are
 * brochure and supply-side pages, so the footer is their only home — there is
 * no secondary nav row (see ADR 0028).
 */
export const FOOTER_LINKS: NavItem[] = [
  { href: "/curator", label: "Supply" },
  { href: "/developers", label: "Developers" },
  { href: "/pricing", label: "Pricing" },
  { href: "/guides", label: "Guides" },
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function navPathname(href: string): string {
  return href.split(/[?#]/)[0] || "/";
}

export function isNavActive(href: string, pathname: string): boolean {
  const p = navPathname(href);
  if (p === "/") return pathname === "/";
  if (p === "/lab" || p.startsWith("/lab/")) return pathname === "/lab" || pathname.startsWith("/lab/");
  if (p === "/runway") return pathname === "/runway" || pathname.startsWith("/runway/");
  return pathname === p;
}
