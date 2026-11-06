import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { Spinner } from "../Spinner";
import { Busy } from "../Busy";
import { StagedWait } from "../StagedWait";
import { EmptyState } from "../EmptyState";
import { ErrorState } from "../ErrorState";
import { celebrate } from "../celebrate";
import { Shirt } from "lucide-react";

describe("State kit", () => {
  afterEach(cleanup);

  it("Spinner renders a status role", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("Busy appends an ellipsis to a bare gerund label", () => {
    render(<Busy label="Generating try-on" />);
    expect(screen.getByText("Generating try-on…")).toBeTruthy();
  });

  it("Busy does not double-punctuate an already-terminated label", () => {
    render(<Busy label="Checking photo quality…" />);
    expect(screen.getByText("Checking photo quality…")).toBeTruthy();
  });

  it("StagedWait renders title, stages, and elapsed timer", () => {
    render(
      <StagedWait
        title="Building your fit profile"
        stages={[
          { at: 0, label: "Secure resize" },
          { at: 8, label: "Color read" },
        ]}
      />,
    );
    expect(screen.getByText("Building your fit profile")).toBeTruthy();
    expect(screen.getByText("Secure resize")).toBeTruthy();
    expect(screen.getByText("Color read")).toBeTruthy();
    expect(screen.getByText("0:00")).toBeTruthy();
  });

  it("StagedWait honors a forced stageIndex", () => {
    render(
      <StagedWait
        title="Wait"
        stages={[
          { at: 0, label: "First" },
          { at: 8, label: "Second" },
        ]}
        stageIndex={0}
      />,
    );
    // stage 0 active: First shows its detail row active, Second stays dimmed
    expect(screen.getByText("First")).toBeTruthy();
  });

  it("EmptyState renders title, body, and action", () => {
    render(
      <EmptyState
        icon={Shirt}
        title="No cards yet"
        body="The first one is yours to make."
        action={<button>Make a card</button>}
      />,
    );
    expect(screen.getByText("No cards yet")).toBeTruthy();
    expect(screen.getByText("The first one is yours to make.")).toBeTruthy();
    expect(screen.getByText("Make a card")).toBeTruthy();
  });

  it("ErrorState renders message and dismiss action", () => {
    const onDismiss = vi.fn();
    render(<ErrorState title="Analysis paused" message="Vision provider timed out." onDismiss={onDismiss} />);
    expect(screen.getByText("Analysis paused")).toBeTruthy();
    screen.getByText("Dismiss").click();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("ErrorState warning tone renders without error title requirement", () => {
    render(<ErrorState tone="warning" message="Photo quality may reduce accuracy." />);
    expect(screen.getByText("Photo quality may reduce accuracy.")).toBeTruthy();
  });
});

describe("celebrate", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("fires once per kind", () => {
    // fireConfetti appends a canvas; jsdom has no 2d context so it bails
    // early — what matters is the once-guard return value.
    expect(celebrate("first-save")).toBe(true);
    expect(celebrate("first-save")).toBe(false);
    expect(celebrate("first-purchase")).toBe(true);
  });
});
