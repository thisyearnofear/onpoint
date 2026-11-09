import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ShareArtifact } from "../ShareArtifact";

const fetchMock = vi.fn();

function setShare(impl?: (data: ShareData) => Promise<void>) {
  Object.defineProperty(window.navigator, "share", { configurable: true, value: impl });
}

function setClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({}) } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  setShare(undefined);
  Object.defineProperty(window.navigator, "clipboard", { configurable: true, value: undefined });
  vi.unstubAllGlobals();
});

describe("ShareArtifact", () => {
  it("clipboard path shares a sid-minted link and logs artifact_shared", async () => {
    setShare(undefined);
    const writeText = vi.fn(async () => {});
    setClipboard(writeText);
    render(<ShareArtifact title="Couple goals" url="/c/card-1" />);

    fireEvent.click(screen.getByRole("button", { name: /Send it/ }));
    // Channel sheet opens — pick copy link explicitly.
    fireEvent.click(await screen.findByRole("button", { name: /Copy link/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const shared = new URL(writeText.mock.calls[0][0]);
    expect(shared.pathname).toBe("/c/card-1");
    expect(shared.searchParams.get("utm_source")).toBe("copy");
    expect(shared.searchParams.get("sid")).toMatch(/^[a-z0-9]{6,16}$/);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/loop/event");
    const body = JSON.parse(init.body);
    expect(body.type).toBe("artifact_shared");
    expect(body.meta.channel).toBe("copy");
    expect(body.meta.path).toBe("/c/card-1");
    // The logged shareId must be the same sid baked into the shared link —
    // the API mirrors it into a look_share row so downstream joins resolve.
    expect(body.meta.shareId).toBe(shared.searchParams.get("sid"));
  });

  it("native share gets the native channel on both the link and the event", async () => {
    const share = vi.fn(async () => {});
    setShare(share);
    render(<ShareArtifact title="A list" url="/w/list-9" />);

    fireEvent.click(screen.getByRole("button", { name: /Send it/ }));
    fireEvent.click(await screen.findByRole("button", { name: /More/ }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const data = share.mock.calls[0][0] as ShareData;
    const shared = new URL(String(data.url));
    expect(shared.searchParams.get("utm_source")).toBe("native");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).meta.channel).toBe("native");
  });
});
