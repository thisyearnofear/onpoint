import { useState, useEffect, useCallback } from "react";
import { StylePreference } from "../lib/middleware/agent-controls";

const STORAGE_KEY = "onpoint-style-preferences";
const SYNC_EVENT = "style-preferences-updated";

function readFromStorage(): Partial<StylePreference> | null {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<Partial<StylePreference> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPreferences(readFromStorage());
    setLoading(false);
  }, []);

  // Cross-component sync: any instance can broadcast a change to all others
  useEffect(() => {
    const handler = () => {
      setPreferences(readFromStorage());
    };
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, []);

  const updatePreferences = useCallback((newPrefs: Partial<StylePreference>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...newPrefs, lastUpdated: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  /** Write to localStorage AND broadcast to all mounted listeners */
  const updatePreferencesWithSync = useCallback((newPrefs: Partial<StylePreference>) => {
    updatePreferences(newPrefs);
    window.dispatchEvent(new CustomEvent(SYNC_EVENT));
  }, [updatePreferences]);

  return { preferences, updatePreferences, updatePreferencesWithSync, loading };
}
