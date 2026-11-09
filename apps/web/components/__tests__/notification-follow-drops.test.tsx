import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@auth0/nextjs-auth0/client", () => ({
  useUser: () => ({ user: null, isLoading: false }),
}));

import { NotificationBell } from "../NotificationBell";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset().mockImplementation(async (url: string) => {
    if (String(url).startsWith("/api/looks")) {
      return {
        ok: true,
        json: async () => ({
          looks: [{ slug: "fresh-drop-zz99", title: "Fresh Drop", createdAt: new Date().toISOString() }],
        }),
      } as unknown as Response;
    }
    return { ok: false, json: async () => ({}) } as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  try {
    localStorage.clear();
    localStorage.setItem("onpoint:follows", JSON.stringify([{ kind: "curator", id: "nia" }]));
    localStorage.removeItem("onpoint:follow-drops-seen");
  } catch {
    /* ignore */
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NotificationBell follow drops", () => {
  it("shows followed-curator drops while logged out", async () => {
    render(<NotificationBell />);
    // Regression: follow notifications were computed inside the Auth0-gated
    // fetch, so logged-out followers — the main audience — never saw them.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Notifications \(1 unread\)/ })).toBeTruthy();
    });
    expect(fetchMock.mock.calls.some(([u]) => String(u).startsWith("/api/looks"))).toBe(true);
  });
});
