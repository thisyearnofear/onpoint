import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GiftClaimClient } from "../GiftClaimClient";

const fetchMock = vi.fn();

function fillForm({ name = "", size = "" } = {}) {
  if (name) fireEvent.change(screen.getByPlaceholderText("Your name"), { target: { value: name } });
  fireEvent.change(screen.getByPlaceholderText("Delivery address"), { target: { value: "12 Riverside Dr, Nairobi" } });
  if (size) fireEvent.change(screen.getByPlaceholderText("Size (if they asked you)"), { target: { value: size } });
  fireEvent.click(screen.getByRole("button", { name: /Claim this gift|Claim the gift/ }));
}

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({
    ok: true,
    json: async () => ({ claimed: true }),
  } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("gift claim form", () => {
  it("sends the recipient's name, address and size in the claim body", async () => {
    render(<GiftClaimClient token="a1b2c3d4-e5f6-7890-abcd-ef1234567890" />);
    fillForm({ name: "Wanjiru", size: "M" });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      address: "12 Riverside Dr, Nairobi",
      name: "Wanjiru",
      size: "M",
    });
  });

  it("omits optional fields the recipient left blank", async () => {
    render(<GiftClaimClient token="a1b2c3d4-e5f6-7890-abcd-ef1234567890" />);
    fillForm();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ address: "12 Riverside Dr, Nairobi" });
  });
});
