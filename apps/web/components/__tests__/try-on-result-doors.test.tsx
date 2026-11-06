import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

vi.mock("@repo/ui/button", () => ({
  Button: ({
    asChild,
    loading: _loading,
    variant: _variant,
    size: _size,
    children,
    ...rest
  }: React.PropsWithChildren<{
    asChild?: boolean;
    loading?: boolean;
    variant?: string;
    size?: string;
  }>) =>
    asChild
      ? React.Children.only(children)
      : React.createElement("button", { type: "button", ...rest }, children),
}));

vi.mock("@repo/ui/card", () => {
  const box = (p: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("div", p, p.children);
  return { Card: box, CardHeader: box, CardContent: box, CardTitle: box };
});

vi.mock("../SafeImage", () => ({
  SafeImage: ({ fill: _fill, unoptimized: _unoptimized, ...rest }: Record<string, unknown>) =>
    React.createElement("img", rest),
}));

import { TryOnResult } from "../VirtualTryOn/TryOnResult";

const RESULT = {
  id: "r1",
  image: "data:image/webp;base64,AAAA",
  description: "Navy cardigan, worn open",
};

function setShare(impl?: (data: ShareData) => Promise<void>) {
  Object.defineProperty(window.navigator, "share", {
    configurable: true,
    value: impl,
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      token: "tk1",
      inviteUrl: "https://onpoint.test/try/tk1",
    }),
  } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
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
  setShare(undefined);
  vi.unstubAllGlobals();
});

describe("TryOnResult next-loop row", () => {
  it("offers Get it on the listing this render is of", () => {
    render(
      <TryOnResult
        result={RESULT}
        sourceListing={{ curatorSlug: "nia", listingId: "l1" }}
      />,
    );
    expect(screen.getByRole("link", { name: /Get it/ }).getAttribute("href")).toBe(
      "/s/nia?item=l1",
    );
  });

  it("Send it mints an invite and shares the token link, never the image blob", async () => {
    const share = vi.fn(async () => {});
    setShare(share);
    render(
      <TryOnResult
        result={RESULT}
        sourceListing={{ curatorSlug: "nia", listingId: "l1" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Send it/ }));
    await act(async () => {});

    const [url, init] = fetchMock.mock.calls.find(
      ([u]) => String(u) === "/api/try-on/invite",
    ) ?? [];
    expect(String(url)).toBe("/api/try-on/invite");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      curatorSlug: "nia",
      listingId: "l1",
    });

    const shared = String(share.mock.calls[0][0].url);
    expect(shared).toMatch(/^https:\/\/onpoint\.test\/try\/tk1\?sid=[a-z0-9]{6,16}&utm_source=native$/);
    expect(shared).not.toContain("data:");
  });

  it("copies the same attributed link when the browser has no share sheet", async () => {
    setShare(undefined);
    const writeText = vi.fn(async () => {});
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(
      <TryOnResult
        result={RESULT}
        sourceListing={{ curatorSlug: "nia", listingId: "l1" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Send it/ }));
    await act(async () => {});

    expect(writeText.mock.calls[0][0]).toMatch(
      /^https:\/\/onpoint\.test\/try\/tk1\?sid=[a-z0-9]{6,16}&utm_source=copy$/,
    );
  });

  it("falls back to supply, and sends nothing, when the render has no listing", () => {
    render(<TryOnResult result={RESULT} />);
    expect(screen.getByRole("link", { name: /Ask a curator who stocks it/ }).getAttribute("href")).toBe(
      "/curators",
    );
    expect(screen.queryByRole("button", { name: /Send it/ })).toBeNull();
  });

  it("holds the row back while the render is still cooking", () => {
    render(
      <TryOnResult
        result={RESULT}
        loading
        sourceListing={{ curatorSlug: "nia", listingId: "l1" }}
      />,
    );
    expect(screen.queryByRole("link", { name: /Get it/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Send it/ })).toBeNull();
  });
});
