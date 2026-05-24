import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OnboardingFlow } from "../OnboardingFlow";

// Mock useUserPreferences hook
const mockUpdatePreferences = vi.fn();
const mockUpdateWithSync = vi.fn();

vi.mock("../../../hooks/useUserPreferences", () => ({
  useUserPreferences: () => ({
    preferences: null,
    loading: false,
    updatePreferences: mockUpdatePreferences,
    updatePreferencesWithSync: mockUpdateWithSync,
  }),
}));

// Mock @repo/ui to avoid workspace React version conflicts
vi.mock("@repo/ui/button", () => ({
  Button: ({ children, onClick, disabled, variant, size, className, ...rest }: any) =>
    React.createElement("button", {
      onClick,
      disabled,
      "data-variant": variant,
      "data-size": size,
      className,
      ...rest,
    }, children),
}));

vi.mock("@repo/ui/card", () => ({
  Card: ({ children, className }: any) =>
    React.createElement("div", { className }, children),
  CardContent: ({ children, className }: any) =>
    React.createElement("div", { "data-testid": "card-content", className }, children),
  CardHeader: ({ children, className }: any) =>
    React.createElement("div", { "data-testid": "card-header", className }, children),
  CardTitle: ({ children, className }: any) =>
    React.createElement("div", { "data-testid": "card-title", className }, children),
  CardDescription: ({ children, className }: any) =>
    React.createElement("div", { "data-testid": "card-description", className }, children),
}));

vi.mock("@repo/ui/progress", () => ({
  Progress: ({ value, className }: any) =>
    React.createElement("div", {
      "data-testid": "progress",
      "data-value": value,
      className,
    }),
}));

function renderFlow(userProgress = {}) {
  const onClose = vi.fn();
  const onComplete = vi.fn();
  const result = render(
    React.createElement(OnboardingFlow, {
      isOpen: true,
      onClose,
      onComplete,
      userProgress,
    }),
  );
  return { onClose, onComplete, ...result };
}

describe("OnboardingFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the welcome step first", () => {
    renderFlow();
    expect(screen.getByText("Welcome to OnPoint")).toBeTruthy();
  });

  it("shows progress indicator with correct step count", () => {
    renderFlow();
    expect(screen.getByText("Step 1 of 5")).toBeTruthy();
  });

  it("disables the previous button on the first step", () => {
    renderFlow();
    const prevButton = screen.getByText("Previous").closest("button");
    expect(prevButton?.disabled).toBe(true);
  });

  it("navigates forward through steps", () => {
    renderFlow();
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Tell Us About Your Style")).toBeTruthy();
  });

  it("navigates back from a later step", () => {
    renderFlow();
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Connect Your Wallet")).toBeTruthy();
    fireEvent.click(screen.getByText("Previous"));
    expect(screen.getByText("Tell Us About Your Style")).toBeTruthy();
  });

  it("shows skip option on non-required steps after welcome", () => {
    renderFlow();
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Skip this step")).toBeTruthy();
  });

  it("skips a non-required step when clicking skip", () => {
    renderFlow();
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Skip this step"));
    expect(screen.getByText("Connect Your Wallet")).toBeTruthy();
  });

  it("disables next on required step when prerequisite not met", () => {
    renderFlow();
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Next"));
    const nextButton = screen.getByText("Next").closest("button");
    expect(nextButton?.disabled).toBe(true);
  });

  it("enables next on wallet step when wallet is connected", () => {
    renderFlow({ hasWallet: true });
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Next"));
    const nextButton = screen.getByText("Next").closest("button");
    expect(nextButton?.disabled).toBe(false);
  });

  it("shows wallet connected message when hasWallet is true", () => {
    renderFlow({ hasWallet: true });
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Wallet connected successfully!")).toBeTruthy();
  });

  it("shows Connect Wallet button when no wallet", () => {
    renderFlow();
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Connect Wallet")).toBeTruthy();
  });

  it("persists preferences when moving to next step from preferences", () => {
    mockUpdateWithSync.mockClear();
    renderFlow();
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Next"));
    expect(mockUpdateWithSync).toHaveBeenCalledOnce();
  });

  it("calls onComplete and onClose when finishing on last step", () => {
    const { onComplete, onClose } = renderFlow({ hasWallet: true });
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByText("Next"));
    }
    fireEvent.click(screen.getByText("Get Started"));
    expect(onComplete).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes when the X button is clicked", () => {
    const { onClose } = renderFlow();
    const closeButtons = screen.getAllByRole("button");
    const xButton = closeButtons.find(
      (btn) => btn.querySelector("svg") && !btn.textContent,
    );
    if (xButton) fireEvent.click(xButton);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("selects a body type when clicked", () => {
    renderFlow();
    fireEvent.click(screen.getByText("Next"));
    const athletic = screen.getByText("Athletic");
    fireEvent.click(athletic);
    expect(athletic.closest("button")?.className).toContain("border-primary");
  });

  it("toggles style aesthetics when clicked", () => {
    renderFlow();
    fireEvent.click(screen.getByText("Next"));
    const streetwearBtn = screen.getByText("Streetwear");
    fireEvent.click(streetwearBtn);
    expect(streetwearBtn.className).toContain("border-transparent");
  });

  it("selects a budget tier when clicked", () => {
    renderFlow();
    fireEvent.click(screen.getByText("Next"));
    const premiumBtn = screen.getByText("Premium");
    fireEvent.click(premiumBtn);
    expect(premiumBtn.closest("button")?.className).toContain("border-primary");
  });

  it("preserves preference selections when navigating back and forward", () => {
    renderFlow();
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Athletic"));
    fireEvent.click(screen.getByText("Streetwear"));
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Previous"));
    expect(screen.getByText("1 selected")).toBeTruthy();
  });
});
