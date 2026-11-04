"use client";

import { useSyncExternalStore } from "react";
import { resolveThemePreference, THEME_STORAGE_KEY, type ThemeMode } from "../theme";

const getSnapshot = (): ThemeMode =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";

const getServerSnapshot = (): ThemeMode => "light";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  const media = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const applyFromStorage = () => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      stored = null;
    }
    const resolved = resolveThemePreference(stored, media?.matches ?? false);
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.style.colorScheme = resolved;
    onChange();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === THEME_STORAGE_KEY) applyFromStorage();
  };
  const onMedia = () => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored !== "light" && stored !== "dark") applyFromStorage();
  };
  window.addEventListener("storage", onStorage);
  media?.addEventListener?.("change", onMedia);
  return () => {
    observer.disconnect();
    window.removeEventListener("storage", onStorage);
    media?.removeEventListener?.("change", onMedia);
  };
}

export function useResolvedTheme(): ThemeMode {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
