import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Lookbook } from "../Lookbook";
import { Cover, Spread, BackPage } from "../pages";

const pages = [
  {
    key: "cover",
    label: "Cover",
    node: <Cover eyebrow="Issue Nº 1" title="For you.">photo-block</Cover>,
  },
  {
    key: "read",
    label: "The read",
    node: <Spread eyebrow="The read">read-content</Spread>,
  },
  {
    key: "back",
    label: "The last page",
    node: <BackPage>back-content</BackPage>,
  },
];

describe("Lookbook", () => {
  it("renders the cover first with its label in the counter", () => {
    render(<Lookbook pages={pages} />);
    expect(screen.getByText("For you.")).toBeTruthy();
    expect(screen.getByText(/Cover · 1 of 3/)).toBeTruthy();
  });

  it("advances on ArrowRight and announces the page to screen readers", () => {
    render(<Lookbook pages={pages} />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("read-content")).toBeTruthy();
    expect(screen.getByText(/The read · 2 of 3/)).toBeTruthy();
    expect(screen.getByText(/Page 2 of 3: The read/)).toBeTruthy();
  });

  it("does not go before the first page or past the last", () => {
    render(<Lookbook pages={pages} />);
    const prev = screen.getByLabelText("Previous page") as HTMLButtonElement;
    const next = screen.getByLabelText("Next page") as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    fireEvent.click(next);
    fireEvent.click(next);
    expect(next.disabled).toBe(true);
    expect(screen.getByText("back-content")).toBeTruthy();
  });
});
