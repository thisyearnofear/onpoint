"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@repo/ui/button";
import { setTheme } from "../lib/theme";
import { useResolvedTheme } from "../lib/hooks/useResolvedTheme";

export function ThemeToggle() {
  const theme = useResolvedTheme();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className="h-9 w-9 border-border/60 bg-card/70 text-foreground hover:bg-muted"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
