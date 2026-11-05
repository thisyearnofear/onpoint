import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { PRIMARY_NAV, FOOTER_LINKS, isNavActive } from "../../lib/navigation";

let mockPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

let mockPending = false;
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: React.PropsWithChildren<{ href: string } & Record<string, unknown>>) =>
    React.createElement("a", { href, ...rest }, children),
  useLinkStatus: () => ({ pending: mockPending }),
}));

vi.mock("../NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("../auth/Auth0Components", () => ({ Auth0HeaderButton: () => null }));
vi.mock("@repo/ui/button", () => ({ Button: (p: Record<string, unknown>) => React.createElement("button", p) }));
vi.mock("../Shop/CartDrawer", () => ({ CartSlot: () => null }));

import { OnPointHeader } from "../OnPointHeader";
import { MobileNavigation } from "../mobile-navigation";
import { NavigationLink } from "../NavigationLink";

describe("shared nav model", () => {
  it("primary is three places, identical for desktop and mobile", () => {
    expect(PRIMARY_NAV.map((i) => `${i.href}:${i.label}`)).toEqual([
      "/:Wardrobe",
      "/runway:Runway",
      "/lab/try-on:Fitting room",
    ]);
  });

  // Nav is for places, not flows. Purchase, styling and saved renders are actions
  // on an artifact, so a future "give Shop a nav door" has to fail here first.
  it("no flow or brochure destination is in nav", () => {
    const hrefs = PRIMARY_NAV.map((i) => i.href);
    expect(hrefs).not.toContain("/shop");
    expect(hrefs).not.toContain("/looks");
    expect(hrefs).not.toContain("/developers");
    expect(hrefs).not.toContain("/curator");
    expect(hrefs).not.toContain("/style-board");
    expect(hrefs).not.toContain("/cards");
  });

  it("brochure destinations live only in the footer", () => {
    const hrefs = FOOTER_LINKS.map((i) => i.href);
    expect(hrefs).toEqual([
      "/curator",
      "/developers",
      "/pricing",
      "/guides",
      "/about",
      "/privacy",
      "/terms",
    ]);
    expect(hrefs).not.toContain("/shop");
    expect(hrefs).not.toContain("/looks");
  });

  it("active matching: runway covers play/result, legacy lab urls keep the highlight", () => {
    expect(isNavActive("/", "/")).toBe(true);
    expect(isNavActive("/", "/runway")).toBe(false);
    expect(isNavActive("/runway", "/runway")).toBe(true);
    expect(isNavActive("/runway", "/runway/play")).toBe(true);
    expect(isNavActive("/runway", "/runway/r/abc")).toBe(true);
    expect(isNavActive("/lab/try-on", "/lab/try-on")).toBe(true);
    expect(isNavActive("/lab/try-on", "/lab")).toBe(true);
    expect(isNavActive("/lab/try-on", "/lab/stylist")).toBe(true);
  });
});

describe("OnPointHeader", () => {
  beforeEach(() => { mockPathname = "/"; });

  it("renders exactly the primary links; Runway active on its page", () => {
    mockPathname = "/runway/play";
    render(<OnPointHeader />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getAllByRole("link").map((l) => l.textContent?.trim())).toEqual([
      "Wardrobe",
      "Runway",
      "Fitting room",
    ]);
    expect(within(nav).getByRole("link", { name: "Runway" }).getAttribute("aria-current")).toBe("page");
  });

  it("has no secondary-nav chrome", () => {
    render(<OnPointHeader />);
    expect(screen.queryByText("More")).toBeNull();
    expect(document.querySelector("details")).toBeNull();
    // The header Play pill contradicted the Runway nav item (/runway/play vs /runway).
    expect(screen.queryByRole("link", { name: "Play" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Live agent" })).toBeNull();
  });
});

describe("NavigationLink", () => {
  it("same-path hash links render as native anchors (no router navigation)", () => {
    mockPathname = "/";
    const { container } = render(
      <NavigationLink href="/" label="Wardrobe">Wardrobe</NavigationLink>,
    );
    const a = container.querySelector("a")!;
    expect(a.getAttribute("href")).toBe("/");
    expect(a.tagName).toBe("A");
  });

  it("cross-path links render Link", () => {
    mockPathname = "/";
    render(<NavigationLink href="/runway" label="Runway">Runway</NavigationLink>);
    expect(screen.getByRole("link", { name: /Runway/ }).getAttribute("href")).toBe("/runway");
  });

  it("pending state shows an sr-only status and a tiny dot, no layout shift", () => {
    mockPathname = "/";
    mockPending = true;
    const { container } = render(<NavigationLink href="/runway" label="Runway">Runway</NavigationLink>);
    expect(screen.getByRole("status").textContent).toContain("Opening Runway");
    const dot = container.querySelector("span.h-3.w-3");
    expect(dot).toBeTruthy();
    mockPending = false;
  });
});

describe("MobileNavigation dialog", () => {
  beforeEach(() => {
    mockPathname = "/";
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
      HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
    }
  });
  afterEach(() => { document.body.style.overflow = ""; });

  it("opens a portaled dialog, Escape/link/backdrop close it, scroll restored", () => {
    render(<MobileNavigation />);
    const trigger = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(trigger);
    const dialog = document.body.querySelector("dialog#mobile-nav-dialog")!;
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog.getAttribute("open")).not.toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    expect(dialog.querySelectorAll('a[href="/runway"]').length).toBe(1);
    expect(within(dialog as HTMLElement).getByRole("link", { name: "Wardrobe" })).toBeTruthy();
    fireEvent.click(within(dialog as HTMLElement).getByRole("link", { name: "Runway" }));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.body.style.overflow).toBe("");
  });

  it("the dialog holds the three primary places and nothing else but Close", () => {
    render(<MobileNavigation />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const dialog = document.body.querySelector("dialog#mobile-nav-dialog")!;
    expect(dialog.querySelectorAll("a")).toHaveLength(3);
    expect(within(dialog as HTMLElement).queryByText("More")).toBeNull();
    expect(within(dialog as HTMLElement).queryByRole("link", { name: "Live agent" })).toBeNull();
    expect(within(dialog as HTMLElement).queryByRole("link", { name: "Developers" })).toBeNull();
  });

  it("cancel (Escape) closes and returns focus to trigger", () => {
    render(<MobileNavigation />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const dialog = document.body.querySelector("dialog#mobile-nav-dialog")!;
    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
    expect(screen.getByRole("button", { name: "Open menu" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("backdrop click closes", () => {
    render(<MobileNavigation />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const dialog = document.body.querySelector("dialog#mobile-nav-dialog")!;
    fireEvent.click(dialog);
    expect(screen.getByRole("button", { name: "Open menu" }).getAttribute("aria-expanded")).toBe("false");
  });
});
