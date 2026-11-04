import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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
vi.mock("../Dashboard/ShopPanel", () => ({ ShopPanel: () => null }));
vi.mock("../Dashboard/HomePanel", () => ({ HomePanel: () => <div>home panel</div> }));
vi.mock("../Dashboard/MyLooksPanel", () => ({ MyLooksPanel: () => null }));
vi.mock("../Dashboard/SettingsPanel", () => ({ SettingsPanel: () => null }));
vi.mock("../Dashboard/MarketIntelPanel", () => ({ MarketIntelPanel: () => null }));

import { TacticalDashboard } from "../Dashboard/TacticalDashboard";

describe("TacticalDashboard onboarding gating", () => {
  it("shows no onboarding modal or Home tooltips on default Try On", () => {
    window.history.replaceState(null, "", "/lab?tab=try-on&from=nia");
    render(<TacticalDashboard />);
    expect(screen.queryByTestId("onboarding")).toBeNull();
    expect(screen.queryByTestId("tooltips")).toBeNull();
    expect(screen.getByText("try-on panel")).toBeTruthy();
  });

  it("mounts onboarding + tooltips only in dashboard mode", () => {
    window.history.replaceState(null, "", "/lab");
    render(<TacticalDashboard />);
    expect(screen.queryByTestId("onboarding")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /^Home$/i })[0]);
    expect(screen.getByTestId("onboarding")).toBeTruthy();
    expect(screen.getByTestId("tooltips")).toBeTruthy();
  });
});
