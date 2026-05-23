import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useUserPreferences } from "../useUserPreferences";

describe("useUserPreferences", () => {
  const STORAGE_KEY = "onpoint-style-preferences";

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("should initialize with null preferences when empty", () => {
    const { result } = renderHook(() => useUserPreferences());
    expect(result.current.preferences).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("should load existing preferences from localStorage", () => {
    const mockPrefs = { bodyType: "athletic" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockPrefs));

    const { result } = renderHook(() => useUserPreferences());
    expect(result.current.preferences).toMatchObject(mockPrefs);
  });

  it("should update preferences and persist to localStorage", () => {
    const { result } = renderHook(() => useUserPreferences());
    
    const newPrefs = { bodyType: "slim", styleAesthetics: ["streetwear"] };
    
    act(() => {
      result.current.updatePreferences(newPrefs);
    });

    expect(result.current.preferences).toMatchObject(newPrefs);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    expect(stored).toMatchObject(newPrefs);
    expect(stored).toHaveProperty("lastUpdated");
  });
});
