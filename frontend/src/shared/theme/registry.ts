// Theme registry: add a skin later = add one entry + corresponding CSS file.
// Components only call listThemes() / setTheme(), never hardcode skin id lists.
// Design: docs/theme-system/THEME_SYSTEM.md · ADDING_A_THEME.md

export const THEME_STORAGE_KEY = "retainpdf.theme";
export const DEFAULT_THEME_ID = "classic";

/** Color swatch preview for Settings page (matches CSS skin primary color; UI thumbnail only) */
export type ThemePreview = {
  bg: string;
  paper: string;
  accent: string;
  ink: string;
  danger: string;
};

export type ThemeGroup = "light" | "dark" | "accent";

/**
 * Theme series (product line dimension, orthogonal to light/dark group):
 * Schools of Thought / 王朝 / 二次元 ... skins are grouped by series field;
 * new series = add one row to this table, Appearance panel automatically gets a new section.
 */
export type ThemeSeries = {
  id: string;
  label: string;
  /** Section sort order; smaller = earlier */
  order: number;
};

export const THEME_SERIES: readonly ThemeSeries[] = [
  { id: "base", label: "Basic", order: 10 },
  { id: "baijia", label: "Schools of Thought", order: 20 },
  // Planned: { id: "wangchao", label: "王朝", order: 30 },
  //          { id: "niji", label: "二次元", order: 40 },
] as const;

export type ThemeDefinition = {
  /** Matches html[data-theme] / filename themes/<id>.css */
  id: string;
  label: string;
  description: string;
  /** Settings page section group */
  group: ThemeGroup;
  /** Sort order; smaller = earlier */
  order: number;
  preview: ThemePreview;
  /**
   * Decor pack name (public static directory decor/<pack>/manifest.json).
   * Default = color‑only skin, zero decor, zero extra downloads.
   * Contract: src/shared/decor/contract.ts · docs/theme-system/DECOR_PACKS.md
   */
  decorPack?: string;
  /** Series id (THEME_SERIES), defaults to "base" Basic series */
  series?: string;
};

/**
 * Registry truth table.
 * Adding a new skin: see docs/theme-system/ADDING_A_THEME.md
 */
export const THEME_REGISTRY: readonly ThemeDefinition[] = [
  {
    id: "classic",
    label: "Classic",
    description: "Restrained black, white, and gray default look",
    group: "light",
    order: 10,
    preview: {
      bg: "#f5f5f7",
      paper: "#ffffff",
      accent: "#1d1d1f",
      ink: "#1d1d1f",
      danger: "#ff3b30",
    },
  },
  {
    id: "jiangnan",
    label: "Plain Paper",
    description: "Cool lime base with cyan-green accents",
    group: "accent",
    order: 20,
    decorPack: "jiangnan",
    preview: {
      bg: "#f1f0ed",
      paper: "#fbfaf8",
      accent: "#2a5f57",
      ink: "#1b1b1d",
      danger: "#c23b32",
    },
  },
  {
    id: "mojia",
    label: "Mohist",
    description: "Warm silk base with bronze mechanical accents",
    group: "accent",
    order: 25,
    decorPack: "mojia",
    series: "baijia",
    preview: {
      bg: "#f2efe8",
      paper: "#faf8f1",
      accent: "#4c6658",
      ink: "#26221b",
      danger: "#b23b32",
    },
  },
  {
    id: "seacliff",
    label: "Misty Cyan",
    description: "Cool blue-gray base with muted cyan accents",
    group: "accent",
    order: 30,
    preview: {
      bg: "#eef1f4",
      paper: "#f8f9fb",
      accent: "#2d5f6e",
      ink: "#1a1d21",
      danger: "#c23b32",
    },
  },
  {
    id: "night",
    label: "Dark Tile Night",
    description: "Dark reading base with ink-black tile tones",
    group: "dark",
    order: 40,
    preview: {
      bg: "#141618",
      paper: "#1e2226",
      accent: "#5aa88e",
      ink: "#e8e6e3",
      danger: "#e07068",
    },
  },
] as const;

export type ThemeId = (typeof THEME_REGISTRY)[number]["id"] | string;

const GROUP_LABEL: Record<ThemeGroup, string> = {
  light: "Light",
  dark: "Dark",
  accent: "Mood",
};

export function themeGroupLabel(group: ThemeGroup): string {
  return GROUP_LABEL[group] || group;
}

export function listThemes(): ThemeDefinition[] {
  return [...THEME_REGISTRY].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function listThemesByGroup(): { group: ThemeGroup; label: string; themes: ThemeDefinition[] }[] {
  const order: ThemeGroup[] = ["light", "accent", "dark"];
  const map = new Map<ThemeGroup, ThemeDefinition[]>();
  for (const t of listThemes()) {
    const list = map.get(t.group) || [];
    list.push(t);
    map.set(t.group, list);
  }
  return order
    .filter((g) => (map.get(g) || []).length > 0)
    .map((group) => ({
      group,
      label: themeGroupLabel(group),
      themes: map.get(group) || [],
    }));
}

/**
 * Group by series (for Appearance panel): series sorted by THEME_SERIES.order;
 * skins without a series fall under "base"; empty series are omitted.
 */
export function listThemesBySeries(): { series: string; label: string; themes: ThemeDefinition[] }[] {
  const map = new Map<string, ThemeDefinition[]>();
  for (const t of listThemes()) {
    const key = t.series && THEME_SERIES.some((s) => s.id === t.series) ? t.series : "base";
    const list = map.get(key) || [];
    list.push(t);
    map.set(key, list);
  }
  return [...THEME_SERIES]
    .sort((a, b) => a.order - b.order)
    .filter((s) => (map.get(s.id) || []).length > 0)
    .map((s) => ({ series: s.id, label: s.label, themes: map.get(s.id) || [] }));
}

export function getThemeDefinition(id: string): ThemeDefinition | undefined {
  return THEME_REGISTRY.find((t) => t.id === id);
}

export function isThemeId(value: unknown): value is string {
  return typeof value === "string" && THEME_REGISTRY.some((t) => t.id === value);
}




