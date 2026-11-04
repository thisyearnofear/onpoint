export interface NavItem {
  href: string;
  label: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/#style-studio", label: "Studio" },
  { href: "/style-board", label: "Outfit ideas" },
  { href: "/lab?tab=try-on", label: "Fitting room" },
  { href: "/runway", label: "Runway" },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#proof", label: "Proof" },
  { href: "/developers", label: "Developers" },
  { href: "/curator", label: "Supply" },
];

export function navPathname(href: string): string {
  return href.split(/[?#]/)[0] || "/";
}

export function isNavActive(href: string, pathname: string): boolean {
  const p = navPathname(href);
  if (p === "/") return pathname === "/";
  if (p === "/style-board") return pathname === "/style-board";
  if (p === "/lab") return pathname === "/lab" || pathname.startsWith("/lab/");
  if (p === "/runway") return pathname === "/runway" || pathname.startsWith("/runway/");
  return pathname === p;
}
