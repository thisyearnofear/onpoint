import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("../Dashboard/NewUserOnboarding", () => ({
  NewUserOnboarding: () => <div data-testid="onboarding" />,
}));
vi.mock("../Dashboard/TryOnPanel", () => ({ TryOnPanel: () => <div>try-on panel</div> }));
vi.mock("../Dashboard/StylistPanel", () => ({ StylistPanel: () => <div>stylist panel</div> }));
vi.mock("../Dashboard/MyLooksPanel", () => ({ MyLooksPanel: () => <div>saved looks</div> }));
vi.mock("../Dashboard/SettingsPanel", () => ({ SettingsPanel: () => <div>settings panel</div> }));

let mockSearch = "";
let cachedSearch = "";
let cachedParams = new URLSearchParams();
// A stable router object: `useRouter: () => ({…})` hands the effect a new
// identity every render, and anything that depends on it re-runs forever.
const { mockPush, mockReplace, router } = vi.hoisted(() => {
  const mockPush = vi.fn();
  const mockReplace = vi.fn();
  return { mockPush, mockReplace, router: { push: mockPush, replace: mockReplace } };
});
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => {
    const search = mockSearch || window.location.search;
    if (search !== cachedSearch) {
      cachedSearch = search;
      cachedParams = new URLSearchParams(search);
    }
    return cachedParams;
  },
  usePathname: () => "/lab",
}));

import { TacticalDashboard } from "../Dashboard/TacticalDashboard";

function panel(id: string): HTMLDetailsElement | null {
  return document.getElementById(id) as HTMLDetailsElement | null;
}

describe("Fitting room flattening", () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    mockSearch = "";
    cachedSearch = "";
    cachedParams = new URLSearchParams();
    mockPush.mockReset();
    mockReplace.mockReset();
    Element.prototype.scrollIntoView = scrollIntoView;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/lab");
  });

  it("is one page: the fitting room with three disclosures, no tab strip", () => {
    window.history.replaceState(null, "", "/lab");
    render(<TacticalDashboard />);

    expect(screen.getByText("try-on panel")).toBeTruthy();
    for (const id of ["your-try-ons", "ask-stylist", "settings"]) {
      expect(panel(id)).toBeTruthy();
    }
    // The tab bar, the mobile bottom nav and the More sheet are gone, so the
    // only buttons in chrome are the disclosures' own summaries.
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tab", { name: /Shop/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^More$/i })).toBeNull();
  });

  it("shows onboarding on the bare landing only", () => {
    window.history.replaceState(null, "", "/lab");
    render(<TacticalDashboard />);
    expect(screen.getByTestId("onboarding")).toBeTruthy();
  });

  it("holds onboarding back when the visitor was deep-linked", () => {
    window.history.replaceState(null, "", "/lab?tab=try-on&from=nia");
    mockSearch = "?tab=try-on&from=nia";
    render(<TacticalDashboard />);
    expect(screen.queryByTestId("onboarding")).toBeNull();
    expect(screen.getByText("try-on panel")).toBeTruthy();
  });

  it("opens the panel a retired tab asked for, then drops the tab", async () => {
    window.history.replaceState(null, "", "/lab?tab=settings");
    mockSearch = "?tab=settings";
    render(<TacticalDashboard />);

    await waitFor(() => expect(panel("settings")?.open).toBe(true));
    expect(window.location.search).not.toContain("tab");
    // The deep-link params the fitting room reads stay put.
    expect(panel("your-try-ons")?.open).toBe(false);
  });

  it("still forwards the shop verb to /shop, item and all", async () => {
    window.history.replaceState(null, "", "/lab?tab=shop&item=l9");
    mockSearch = "?tab=shop&item=l9";
    render(<TacticalDashboard />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/shop?item=l9"));
  });

  it("opens a panel named by a hash, so the retired-mode 301s land somewhere visible", async () => {
    window.history.replaceState(null, "", "/lab/try-on#your-try-ons");
    render(<TacticalDashboard />);

    await waitFor(() => expect(panel("your-try-ons")?.open).toBe(true));
    expect(window.location.hash).toBe("#your-try-ons");
  });
});
