import { useState, useEffect, useCallback } from "react";
import { StylePreference } from "../lib/middleware/agent-controls";

const STORAGE_KEY = "onpoint-style-preferences";

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<Partial<StylePreference> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setPreferences(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse preferences from localStorage", e);
      }
    }
    setLoading(false);
  }, []);

  const updatePreferences = useCallback((newPrefs: Partial<StylePreference>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...newPrefs, lastUpdated: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { preferences, updatePreferences, loading };
}
