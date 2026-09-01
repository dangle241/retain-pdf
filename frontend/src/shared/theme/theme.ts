// Theme skin runtime API
// Registry: ./registry.ts Â· Docs: docs/theme-system/

import {
  DEFAULT_THEME_ID,
  THEME_STORAGE_KEY,
  getThemeDefinition,
  isThemeId,
  listThemes,
  listThemesByGroup,
  type ThemeId,
} from "./registry.js";

export {
  DEFAULT_THEME_ID,
  THEME_STORAGE_KEY,
  THEME_REGISTRY,
  THEME_SERIES,
  getThemeDefinition,
  isThemeId,
  listThemes,
  listThemesByGroup,
  listThemesBySeries,
  themeGroupLabel,
  type ThemeDefinition,
  type ThemeGroup,
  type ThemeId,
  type ThemePreview,
  type ThemeSeries,
} from "./registry.js";

/** Compatible with old import names */
export const THEME_IDS = listThemes().map((t) => t.id);
export const THEME_META = Object.fromEntries(
  listThemes().map((t) => [t.id, { id: t.id, label: t.label, description: t.description }]),
);

export const THEME_CHANGE_EVENT = "retainpdf:theme-change";

export function getStoredTheme(): ThemeId {
  if (typeof localStorage === "undefined") return DEFAULT_THEME_ID;
  try {
    const raw = `${localStorage.getItem(THEME_STORAGE_KEY) || ""}`.trim();
    if (isThemeId(raw)) return raw;
  } catch {
    /* private mode */
  }
  return DEFAULT_THEME_ID;
}

export function getTheme(): ThemeId {
  if (typeof document !== "undefined") {
    const fromDom = document.documentElement.dataset.theme;
    if (isThemeId(fromDom)) return fromDom;
  }
  return getStoredTheme();
}

/** Write to storage + <html data-theme> broadcast event */
export function setTheme(theme: ThemeId) {
  const next = isThemeId(theme) ? theme : DEFAULT_THEME_ID;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = next;
// Dark skin available body class `ponytail:` per-component write hook. Skip: custom store. Add when: shared state grows. .theme-dark special case
    const def = getThemeDefinition(next);
    document.documentElement.dataset.themeGroup = def?.group || "light";
    document.documentElement.classList.toggle("theme-dark", def?.group === "dark");
  }
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme: next } }),
      );
    } catch {
      /* ignore */
    }
  }
  return next;
}

/** Call at entry top. Reduce theme switching. FOUC */
export function bootTheme() {
  return setTheme(getStoredTheme());
}
