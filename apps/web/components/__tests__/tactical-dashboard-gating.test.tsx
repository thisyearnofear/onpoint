import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../Dashboard/NewUserOnboarding", () => ({
  NewUserOnboarding: () => <div data-testid="onboarding" />,
}));
vi.mock("../Dashboard/DashboardTooltips", () => ({
  DashboardTooltips: () => <div data-testid="tooltips" />,
}));
vi.mock("../NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("../AgentWalletBadge", () => ({ AgentWalletBadge: () => null }));
vi.mock("../AttestationBadge", () => ({ AttestationBadge: () => null }));
vi.mock("../EnhancedConnectButton", () => ({ EnhancedConnectButton: () => null }));
vi.mock("../Dashboard/TryOnPanel", () => ({ TryOnPanel: () => <div>try-on panel</div> }));
vi.mock("../Dashboard/StylistPanel", () => ({ StylistPanel: () => null }));
vi.mock("../Dashboard/MyLooksPanel", () => ({ MyLooksPanel: () => null }));
vi.mock("../Dashboard/SettingsPanel", () => ({ SettingsPanel: () => null }));
vi.mock("../Dashboard/MarketIntelPanel", () => ({ MarketIntelPanel: () => null }));

let mockSearch = "";
let cachedSearch = "";
let cachedParams = new URLSearchParams();
const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
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

describe("TacticalDashboard onboarding gating", () => {
  beforeEach(() => {
    mockSearch = "";
    cachedSearch = "";
    cachedParams = new URLSearchParams();
  });

  it("shows no onboarding modal or Home tooltips on default Try On", () => {
    window.history.replaceState(null, "", "/lab?tab=try-on&from=nia");
    render(<TacticalDashboard />);
    expect(screen.queryByTestId("onboarding")).toBeNull();
    expect(screen.queryByTestId("tooltips")).toBeNull();
    expect(screen.getByText("try-on panel")).toBeTruthy();
  });

  it("mounts onboarding + tooltips on the try-on landing only", () => {
    window.history.replaceState(null, "", "/lab");
    render(<TacticalDashboard />);
    expect(screen.getByTestId("onboarding")).toBeTruthy();
    expect(screen.getByTestId("tooltips")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /^Saved$/i })[0]);
    expect(screen.queryByTestId("onboarding")).toBeNull();
  });

  it("returns to Try On when its navigation query changes without remounting", async () => {
    window.history.replaceState(null, "", "/lab");
    const view = render(<TacticalDashboard />);
    fireEvent.click(screen.getAllByRole("button", { name: /^Shop$/i })[0]);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/shop"));

    mockSearch = "?tab=try-on";
    view.rerender(<TacticalDashboard />);

    await waitFor(() => expect(screen.getByText("try-on panel")).toBeTruthy());
  });
});
