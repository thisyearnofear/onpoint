export interface NavItem {
  href: string;
  label: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Wardrobe" },
  { href: "/runway", label: "Runway" },
  { href: "/lab/try-on", label: "Fitting room" },
  { href: "/shop", label: "Shop" },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/looks", label: "Create a look" },
  { href: "/developers", label: "Developers" },
  { href: "/curator", label: "Supply" },
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
