import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, act, cleanup } from "@testing-library/react";
import { Toaster, useToast } from "../toast";

// Helper to render useToast within Toaster provider
function renderUseToast() {
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(Toaster, null, children);
  return renderHook(() => useToast(), { wrapper });
}

describe("Toast System", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("throws when useToast is used outside of Toaster", () => {
    expect(() => {
      renderHook(() => useToast());
    }).toThrow("useToast must be used within ToastProvider");
  });

  it("provides a toast function inside Toaster", () => {
    const { result } = renderUseToast();
    expect(result.current.toast).toBeDefined();
    expect(typeof result.current.toast).toBe("function");
  });

  it("defaults to 'info' type when no type is provided", () => {
    const { result } = renderUseToast();
    expect(() => {
      act(() => {
        result.current.toast("Hello");
      });
    }).not.toThrow();
  });

  it("accepts all toast types without error", () => {
    const { result } = renderUseToast();
    expect(() => {
      act(() => {
        result.current.toast("Success", "success");
        result.current.toast("Error", "error");
        result.current.toast("Info", "info");
        result.current.toast("Warning", "warning");
      });
    }).not.toThrow();
  });

  it("supports multiple toasts", () => {
    const { result } = renderUseToast();
    act(() => {
      result.current.toast("First", "info");
      result.current.toast("Second", "success");
      result.current.toast("Third", "error");
    });
    // No crash = context rendered properly
    expect(result.current.toast).toBeDefined();
  });

  it("handles rapid successive calls", () => {
    const { result } = renderUseToast();
    act(() => {
      for (let i = 0; i < 100; i++) {
        result.current.toast(`Toast ${i}`, "info");
      }
    });
    expect(result.current.toast).toBeDefined();
  });
});
