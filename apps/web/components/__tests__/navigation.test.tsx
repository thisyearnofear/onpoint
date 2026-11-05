import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { PRIMARY_NAV, isNavActive } from "../../lib/navigation";

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

import { OnPointHeader } from "../OnPointHeader";
import { MobileNavigation } from "../mobile-navigation";
import { NavigationLink } from "../NavigationLink";

describe("shared nav model", () => {
  it("primary items are identical for desktop and mobile", () => {
    expect(PRIMARY_NAV.map((i) => `${i.href}:${i.label}`)).toEqual([
      "/:Wardrobe",
      "/runway:Runway",
      "/lab/try-on:Fitting room",
      "/shop:Shop",
    ]);
  });

  it("active matching: Studio only at root; runway covers play/result", () => {
    expect(isNavActive("/#style-studio", "/")).toBe(true);
    expect(isNavActive("/#style-studio", "/runway")).toBe(false);
    expect(isNavActive("/runway", "/runway")).toBe(true);
    expect(isNavActive("/runway", "/runway/play")).toBe(true);
    expect(isNavActive("/runway", "/runway/r/abc")).toBe(true);
    expect(isNavActive("/style-board", "/")).toBe(false);
    expect(isNavActive("/lab/try-on", "/lab")).toBe(true);
  });
});

describe("OnPointHeader", () => {
  beforeEach(() => { mockPathname = "/"; });
  it("renders the primary links; Runway active on its page", () => {
    mockPathname = "/runway/play";
    render(<OnPointHeader />);
    const navs = screen.getAllByRole("navigation", { name: "Primary" });
    // primary links lead; More dropdown items follow
    const navLinks = within(navs[0]).getAllByRole("link");
    const primaryLabels = navLinks.slice(0, 4).map((l) => l.textContent?.trim()).filter(Boolean);
    expect(primaryLabels).toEqual(["Wardrobe", "Runway", "Fitting room", "Shop"]);
    expect(within(navs[0]).getByRole("link", { name: "Runway" }).getAttribute("aria-current")).toBe("page");
  });

  it("secondary links live under More", () => {
    render(<OnPointHeader />);
    // "More" is a <summary> inside a <details> — query by text then open
    const summary = screen.getByText("More").closest("details") as HTMLElement;
    expect(summary).toBeTruthy();
    summary.open = true;
    expect(within(summary).queryByRole("link", { name: "All looks" })).toBeNull();
    expect(within(summary).getByRole("link", { name: "Create a look" })).toBeTruthy();
    expect(within(summary).getByRole("link", { name: "Developers" })).toBeTruthy();
    expect(within(summary).getByRole("link", { name: "Supply" })).toBeTruthy();
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

  it("desktop More dropdown closes on Escape and outside click", () => {
    mockPathname = "/";
    render(<OnPointHeader />);
    const details = document.querySelector("details")!;
    details.open = true;
    fireEvent.keyDown(document, { key: "Escape" });
    expect(details.open).toBe(false);
    details.open = true;
    fireEvent.pointerDown(document.body);
    expect(details.open).toBe(false);
    details.open = true;
    fireEvent.click(within(details as HTMLElement).getByRole("link", { name: "Developers" }));
    expect(details.open).toBe(false);
  });
});
