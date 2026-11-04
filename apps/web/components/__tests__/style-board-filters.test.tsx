import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, fireEvent, act } from "@testing-library/react";
import { StyleBoard } from "../style-board/StyleBoard";
import { STYLE_OUTFITS } from "../../lib/style-board";
import { useStyleHearts } from "../../lib/stores/style-board-hearts";

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
}));

describe("StyleBoard occasion filters", () => {
  afterEach(() => {
    act(() => useStyleHearts.setState({ hearts: [] }));
  });

  it("filters cards by tag group and restores All", () => {
    render(<StyleBoard />);
    expect(screen.getAllByRole("link", { name: /Get a verdict/i }).length).toBe(STYLE_OUTFITS.length);

    const work = screen.getByRole("button", { name: "Work" });
    fireEvent.click(work);
    expect(work.getAttribute("aria-pressed")).toBe("true");
    const expected = STYLE_OUTFITS.filter((o) => o.tags.some((t) => ["business", "office", "work"].includes(t)));
    expect(screen.getAllByRole("link", { name: /Get a verdict/i }).length).toBe(expected.length);
    expect(screen.getByText(`${expected.length} looks`)).toBeTruthy();
    expect(screen.queryByAltText("Field jacket + hoodie")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getAllByRole("link", { name: /Get a verdict/i }).length).toBe(STYLE_OUTFITS.length);
    expect(screen.getByText(`${STYLE_OUTFITS.length} looks`)).toBeTruthy();
  });

  it("keeps My picks independent of the active filter", async () => {
    act(() => useStyleHearts.setState({ hearts: ["aut-0169"] }));
    render(<StyleBoard />);
    expect(await screen.findByText("My picks")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Work" }));
    const picksLabel = screen.getByText("My picks").parentElement!;
    expect(within(picksLabel).getByAltText("Field jacket + hoodie")).toBeTruthy();
  });
});
