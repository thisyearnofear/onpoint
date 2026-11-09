import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReactionBar } from "../ReactionBar";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({}) } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

describe("ReactionBar", () => {
  it("records a one-tap reaction and logs it", async () => {
    render(<ReactionBar targetType="look" targetId="look-1" lookSlug="look-1" />);
    fireEvent.click(screen.getByRole("button", { name: /need this/ }));
    expect(await screen.findByText("1")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/loop/event");
    const body = JSON.parse(init.body);
    expect(body.type).toBe("reaction");
    expect(body.meta.emoji).toBe("🔥");
    expect(body.meta.targetId).toBe("look-1");
  });

  it("does not double-count the same emoji", () => {
    render(<ReactionBar targetType="polaroid" targetId="p-9" />);
    const btn = screen.getByRole("button", { name: /love it/ });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
