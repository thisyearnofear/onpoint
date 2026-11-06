import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReportCard } from "../ReportCard";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ listed: false }) } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ReportCard", () => {
  it("delists the card and settles to a plain confirmation", async () => {
    render(<ReportCard id="card-1" />);
    fireEvent.click(screen.getByRole("button", { name: /Take it off the board/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/couple/card/card-1/report");
    expect(init.method).toBe("POST");

    await screen.findByText(/off the board/);
  });
});
