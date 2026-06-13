import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { AutoDismissTimer } from "../AutoDismissTimer";

describe("AutoDismissTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires onDismiss after the configured delay", () => {
    const onDismiss = vi.fn();
    render(<AutoDismissTimer ms={1000} onDismiss={onDismiss} />);

    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not fire before the delay", () => {
    const onDismiss = vi.fn();
    render(<AutoDismissTimer ms={5000} onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("clears the timer on unmount", () => {
    const onDismiss = vi.fn();
    const { unmount } = render(
      <AutoDismissTimer ms={1000} onDismiss={onDismiss} />,
    );
    act(() => {
      vi.advanceTimersByTime(500);
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("always calls the LATEST onDismiss (via ref), not the initial one", () => {
    const onDismiss1 = vi.fn();
    const onDismiss2 = vi.fn();

    const { rerender } = render(
      <AutoDismissTimer ms={1000} onDismiss={onDismiss1} />,
    );

    // Simulate the parent re-rendering with a new callback before the timer fires.
    // This is the case the ref guards against — without the ref, the timer
    // would be reset by every re-render and never fire.
    rerender(<AutoDismissTimer ms={1000} onDismiss={onDismiss2} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onDismiss1).not.toHaveBeenCalled();
    expect(onDismiss2).toHaveBeenCalledTimes(1);
  });

  it("does not reset the timer when only the callback changes (ref pattern)", () => {
    const onDismiss1 = vi.fn();
    const onDismiss2 = vi.fn();

    const { rerender } = render(
      <AutoDismissTimer ms={1000} onDismiss={onDismiss1} />,
    );

    // Advance 800ms (less than the full 1000ms delay)
    act(() => {
      vi.advanceTimersByTime(800);
    });

    // Re-render with a new callback at t=800ms
    rerender(<AutoDismissTimer ms={1000} onDismiss={onDismiss2} />);

    // Advance the remaining 200ms
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // The new callback should fire, proving the timer wasn't reset to 1000ms
    // (which would have required another 800ms of advancement).
    expect(onDismiss2).toHaveBeenCalledTimes(1);
  });
});
