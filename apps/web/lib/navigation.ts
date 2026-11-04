export interface NavItem {
  href: string;
  label: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Looks" },
  { href: "/runway", label: "Runway" },
  { href: "/lab?tab=try-on", label: "Fitting room" },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/looks", label: "Create a look" },
  { href: "/developers", label: "Developers" },
  { href: "/curator", label: "Supply" },
];

export function navPathname(href: string): string {
  return href.split(/[?#]/)[0] || "/";
}

export function isNavActive(href: string, pathname: string): boolean {
  const p = navPathname(href);
  if (p === "/") return pathname === "/";
  if (p === "/lab") return pathname === "/lab" || pathname.startsWith("/lab/");
  if (p === "/runway") return pathname === "/runway" || pathname.startsWith("/runway/");
  return pathname === p;
}
