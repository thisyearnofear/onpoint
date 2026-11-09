import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const replace = vi.fn();
let mockParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => "/s/nia",
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => mockParams,
}));

import { AttributeFilterBar } from "../StorefrontFilters";

const facets = { type: ["top"], formality: ["casual", "formal"], warmth: ["light"] };

describe("AttributeFilterBar", () => {
  beforeEach(() => {
    replace.mockClear();
    mockParams = new URLSearchParams();
  });

  it("renders nothing when no facets exist", () => {
    const { container } = render(
      <AttributeFilterBar facets={{ type: [], formality: [], warmth: [] }} shown={0} total={3} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders chips for each facet group", () => {
    render(<AttributeFilterBar facets={facets} shown={3} total={3} />);
    expect(screen.getByText("Piece")).toBeTruthy();
    expect(screen.getByText("Vibe")).toBeTruthy();
    expect(screen.getByText("Weight")).toBeTruthy();
    expect(screen.getByRole("button", { name: "top" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "casual" })).toBeTruthy();
  });

  it("sets the filter param on click, preserving other params", () => {
    mockParams = new URLSearchParams("item=abc");
    render(<AttributeFilterBar facets={facets} shown={1} total={3} />);
    fireEvent.click(screen.getByRole("button", { name: "top" }));
    expect(replace).toHaveBeenCalledWith("/s/nia?item=abc&type=top", { scroll: false });
  });

  it("clears the param when the active chip is clicked again", () => {
    mockParams = new URLSearchParams("type=top&formality=casual");
    render(<AttributeFilterBar facets={facets} shown={1} total={3} />);
    fireEvent.click(screen.getByRole("button", { name: "top" }));
    expect(replace).toHaveBeenCalledWith("/s/nia?formality=casual", { scroll: false });
  });

  it("marks the active chip and offers a clear-all", () => {
    mockParams = new URLSearchParams("warmth=light");
    render(<AttributeFilterBar facets={facets} shown={2} total={3} />);
    expect(
      screen.getByRole("button", { name: "light" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByText(/Showing 2 of 3/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(replace).toHaveBeenCalledWith("/s/nia", { scroll: false });
  });
});
