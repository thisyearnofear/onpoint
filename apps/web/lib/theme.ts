export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "onpoint-theme";

export function resolveThemePreference(
  stored: string | null,
  systemDark: boolean,
): ThemeMode {
  if (stored === "light" || stored === "dark") return stored;
  return systemDark ? "dark" : "light";
}

export function setTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    void 0;
  }
}

export const THEME_INIT_SCRIPT = `(() => {
  try {
    const storageKey = 'onpoint-theme';
    let stored = null;
    try {
      stored = localStorage.getItem(storageKey);
    } catch {}
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolved = (stored === 'light' || stored === 'dark') ? stored : (systemDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    document.documentElement.style.colorScheme = resolved;

    // Adaptive performance: detect low-end devices
    // Check for low memory, low CPU cores, or small viewport + reduced motion
    const deviceMemory = navigator.deviceMemory;
    const isLowEnd = (
      deviceMemory !== undefined && deviceMemory <= 4 ||
      navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 4 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      window.matchMedia('(prefers-reduced-data: reduce)').matches
    );
    if (isLowEnd) {
      document.documentElement.classList.add('low-end-device');
    }
  } catch {}
})();`;
