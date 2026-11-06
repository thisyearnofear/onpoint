import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CoupleClient } from "../CoupleClient";

const LOOKS = [
  { slug: "weekend-fit", title: "Weekend fit" },
  { slug: "date-night", title: "Date night" },
];

const fetchMock = vi.fn();

async function makeCard() {
  const file = new File(["x"], "us.jpg", { type: "image/jpeg" });
  fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
    target: { files: [file] },
  });
  await screen.findByAltText("You two");
  fireEvent.click(screen.getByRole("button", { name: /Make the card/ }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0];
  return { url, body: JSON.parse(init.body) };
}

beforeEach(() => {
  sessionStorage.clear();
  fetchMock.mockReset().mockResolvedValue({
    ok: true,
    json: async () => ({ cardUrl: "https://r2.test/c1.png", pageUrl: "https://app.test/c/abc" }),
  } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("couple card creation", () => {
  it("joins the card to the share that brought the sender in", async () => {
    sessionStorage.setItem("onpoint_share", JSON.stringify({ sid: "abc123", channel: "whatsapp" }));
    render(<CoupleClient looks={LOOKS} />);
    fireEvent.click(screen.getByRole("button", { name: /Add a photo/ }));

    const { url, body } = await makeCard();
    expect(url).toBe("/api/couple/render");
    expect(body.shareId).toBe("abc123");
    expect(body.shareChannel).toBe("whatsapp");
    expect(body.lookSlug).toBe("weekend-fit");
  });

  it("sends no share fields on a direct visit", async () => {
    render(<CoupleClient looks={LOOKS} />);
    fireEvent.click(screen.getByRole("button", { name: /Add a photo/ }));

    const { body } = await makeCard();
    expect(body.shareId).toBeUndefined();
    expect(body.shareChannel).toBeUndefined();
  });

  it("lists on the public board by default and honors the opt-out", async () => {
    render(<CoupleClient looks={LOOKS} />);
    fireEvent.click(screen.getByRole("button", { name: /Add a photo/ }));
    const { body } = await makeCard();
    expect(body.listed).toBe(true);
  });

  it("sends listed=false when the sender unticks the board box", async () => {
    render(<CoupleClient looks={LOOKS} />);
    const file = new File(["x"], "us.jpg", { type: "image/jpeg" });
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [file] },
    });
    await screen.findByAltText("You two");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Make the card/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).listed).toBe(false);
  });
});
