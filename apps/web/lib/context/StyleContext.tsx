"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useUserPreferences } from "../../hooks/useUserPreferences";
import type { StylePreference } from "../../lib/middleware/agent-controls";

interface StyleContextValue {
  preferences: Partial<StylePreference> | null;
  loading: boolean;
  updatePreferences: (updates: Partial<StylePreference>) => void;
  dominantAesthetic: string | null;
  budgetLabel: string | null;
  bodyTypeLabel: string | null;
}

const StyleContext = createContext<StyleContextValue | undefined>(undefined);

export function StyleProvider({ children }: { children: React.ReactNode }) {
  const { preferences, loading, updatePreferences } = useUserPreferences();

  const value: StyleContextValue = useMemo(() => {
    const aesthetics = preferences?.styleAesthetics ?? [];
    return {
      preferences,
      loading,
      updatePreferences,
      dominantAesthetic: aesthetics.length > 0 ? (aesthetics[0] as string) : null,
      budgetLabel: preferences?.budgetTier ?? null,
      bodyTypeLabel: preferences?.bodyType ?? null,
    };
  }, [preferences, loading, updatePreferences]);

  return React.createElement(StyleContext.Provider, { value }, children);
}

export function useStyleContext(): StyleContextValue {
  const ctx = useContext(StyleContext);
  if (!ctx) {
    throw new Error("useStyleContext must be used within a StyleProvider");
  }
  return ctx;
}

export { StyleContext };
export type { StyleContextValue };
