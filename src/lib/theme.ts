// The site's color theme. With no remembered choice the page follows the
// system setting through CSS alone; a remembered choice is written to
// `data-theme` on <html>, which the tokens in src/app/globals.css obey.

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = "theme";

/** Narrows a value read from storage to a Theme, or null if it isn't one. */
export function parseTheme(value: unknown): Theme | null {
  return THEMES.find((theme) => theme === value) ?? null;
}

/**
 * Inline script for <head>. It runs while the HTML is parsed, before first
 * paint, so a remembered choice never flashes the system theme first.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(${JSON.stringify(THEMES)}.indexOf(t)>-1)document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
