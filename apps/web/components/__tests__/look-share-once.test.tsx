import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LookShareButton } from "../../app/look/[slug]/LookShareButton";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({}) } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(window.navigator, "share", { configurable: true, value: undefined });
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(async () => {}) },
  });
  if (!window.crypto.getRandomValues) {
    Object.defineProperty(window.crypto, "getRandomValues", {
      configurable: true,
      value: (bytes: Uint8Array) => {
        for (let i = 0; i < bytes.length; i += 1) bytes[i] = i;
        return bytes;
      },
    });
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LookShareButton", () => {
  it("posts exactly one look share event per send", async () => {
    render(
      <LookShareButton lookSlug="weekend-fit-ab12" title="Weekend Fit" url="/look/weekend-fit-ab12" />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Share$/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Copy link/ }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/api/loop/event"))).toBe(true),
    );
    const lookShares = fetchMock.mock.calls.filter(([u]) =>
      String(u).includes("/api/looks/weekend-fit-ab12/share"),
    );
    // Regression: ShareSheet.logShare already posts the look share when
    // lookSlug is set, so an onShare hook posting it again doubled every
    // share in the funnel. There must be exactly one.
    expect(lookShares).toHaveLength(1);
  });
});
