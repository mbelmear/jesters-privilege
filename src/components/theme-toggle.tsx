"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useLayoutEffect, useSyncExternalStore } from "react";
import { Toggle } from "@/components/ui/toggle";
import { THEME_STORAGE_KEY, parseTheme, type Theme } from "@/lib/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

// Toggles on the page, told when one of them makes a choice.
const choiceListeners = new Set<() => void>();

// The theme in effect is a remembered choice on <html> when there is one,
// otherwise the system setting, which can change while the page is open.
function subscribe(onChange: () => void) {
  const system = window.matchMedia(DARK_QUERY);
  system.addEventListener("change", onChange);
  choiceListeners.add(onChange);
  return () => {
    system.removeEventListener("change", onChange);
    choiceListeners.delete(onChange);
  };
}

function currentTheme(): Theme {
  const chosen = parseTheme(
    document.documentElement.getAttribute("data-theme")
  );
  return chosen ?? (window.matchMedia(DARK_QUERY).matches ? "dark" : "light");
}

// The server can't know the theme; the toggle settles on hydration.
const serverTheme = (): Theme => "light";

function rememberedTheme(): Theme | null {
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

function choose(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  choiceListeners.forEach((listener) => listener());
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Not remembered (private mode, storage full); this page still switches.
  }
}

export function ThemeToggle({ label }: { label: string }) {
  const theme = useSyncExternalStore(subscribe, currentTheme, serverTheme);

  // In development React's remount clears attributes the pre-paint script set
  // on <html>; restore the remembered choice. A no-op in production.
  useLayoutEffect(() => {
    const remembered = rememberedTheme();
    if (remembered)
      document.documentElement.setAttribute("data-theme", remembered);
  }, []);

  return (
    <Toggle
      size="lg"
      pressed={theme === "dark"}
      onPressedChange={(dark) => choose(dark ? "dark" : "light")}
    >
      {theme === "dark" ? <MoonIcon aria-hidden /> : <SunIcon aria-hidden />}
      <span className="sr-only">{label}</span>
    </Toggle>
  );
}
