import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStartButton } from "../useStartButton";

describe("useStartButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts idle (showSpinner=false) with isInitializing=false", () => {
    const onStart = vi.fn();
    const { result } = renderHook(() => useStartButton(onStart, false));
    expect(result.current.isStarting).toBe(false);
    expect(result.current.showSpinner).toBe(false);
  });

  it("flips showSpinner=true immediately on click, before the delay", () => {
    const onStart = vi.fn();
    const { result } = renderHook(() => useStartButton(onStart, false));

    act(() => {
      result.current.handleStart();
    });

    expect(result.current.isStarting).toBe(true);
    expect(result.current.showSpinner).toBe(true);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("calls onStart after the configured delay", () => {
    const onStart = vi.fn();
    const { result } = renderHook(() => useStartButton(onStart, false, 200));

    act(() => {
      result.current.handleStart();
    });
    expect(onStart).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(onStart).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("ignores repeated clicks while isStarting is true", () => {
    const onStart = vi.fn();
    const { result } = renderHook(() => useStartButton(onStart, false));

    act(() => {
      result.current.handleStart();
      result.current.handleStart();
      result.current.handleStart();
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("ignores clicks while isInitializing is true (from the parent)", () => {
    const onStart = vi.fn();
    const { result } = renderHook(() => useStartButton(onStart, true));

    act(() => {
      result.current.handleStart();
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onStart).not.toHaveBeenCalled();
    expect(result.current.showSpinner).toBe(true);
  });

  it("resets isStarting when isInitializing flips back to false", () => {
    const onStart = vi.fn();
    const { result, rerender } = renderHook(
      ({ init }: { init: boolean }) => useStartButton(onStart, init),
      { initialProps: { init: false } },
    );

    act(() => {
      result.current.handleStart();
    });
    expect(result.current.isStarting).toBe(true);

    // Simulate the parent kicking off initialization
    rerender({ init: true });
    expect(result.current.showSpinner).toBe(true);

    // Simulate the user cancelling — isInitializing goes false
    rerender({ init: false });
    expect(result.current.isStarting).toBe(false);
    expect(result.current.showSpinner).toBe(false);
  });

  it("uses a custom delay when provided", () => {
    const onStart = vi.fn();
    const { result } = renderHook(() => useStartButton(onStart, false, 50));

    act(() => {
      result.current.handleStart();
    });

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
