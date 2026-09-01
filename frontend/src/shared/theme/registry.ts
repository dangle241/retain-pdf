// Theme registry: add skins later = add one item + corresponding CSS file.
// Component read-only listThemes() / setTheme(), do not hardcode skin ID lists.
// Design:docs/theme-system/THEME_SYSTEM.md · ADDING_A_THEME.md

export const THEME_STORAGE_KEY = "retainpdf.theme";
export const DEFAULT_THEME_ID = "classic";

/** Settings page color block preview (consistent with CSS Skin primary color consistent, only for UI Abbreviated) */
export type ThemePreview = {
  bg: string;
  paper: string;
  accent: string;
  ink: string;
  danger: string;
};

export type ThemeGroup = "light" | "dark" | "accent";

/**
 * Theme series (product line dimension, light/dark group Orthogonal):
* Hundred Schools of Thought / Dynasties / Anime... Skin mount series field realignment.
 * New series = Add row to table; appearance panel auto-displays new section.
 */
export type ThemeSeries = {
  id: string;
  label: string;
  /** Sort partitions ascending. */
  order: number;
};

export const THEME_SERIES: readonly ThemeSeries[] = [
  { id: "base", label: "基础", order: 10 },
  { id: "baijia", label: "Hundred Schools of Thought", order: 20 },
  // In planning:{ id: "wangchao", label: "dynasty", order: 30 },
  //         { id: "niji", label: "Anime", order: 40 },
] as const;

export type ThemeDefinition = {
/** Consistent with html[data-theme] / filename themes/<id>.css */
  id: string;
  label: string;
  description: string;
  /** Settings page group */
  group: ThemeGroup;
  /** Sort list ascending. */
  order: number;
  preview: ThemePreview;
  /**
* Package name for decoration (public static directory decor/<package>/manifest.json).
* Default = pure color scheme skin, zero decoration, zero extra downloads.
* Contract: src/shared/decor/contract.ts Â· docs/theme-system/DECOR_PACKS.md
   */
  decorPack?: string;
  /** Series id（THEME_SERIES)`, default to ` "base" Base series */
  series?: string;
};

/**
 * Registry truth value.
 * See steps to add new skin docs/theme-system/ADDING_A_THEME.md
 */
export const THEME_REGISTRY: readonly ThemeDefinition[] = [
  {
    id: "classic",
    label: "Classic",
    description: "Restrained black-white-gray, default look.",
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
    description: "Cold Lime Base · Cool cyan-green highlight (remove earthy yellow)",
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
    label: "Mohism",
    description: "Warm plain silk base · Bronze Mechanism",
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
    label: "Misty green",
    description: "Cool Gray Blue · Blue-gray emphasis",
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
    label: "Night Tiles",
    description: "Deep Reading · Ink-black tiles",
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
 * Group by series (appearance panel consumption): series by THEME_SERIES.order Sort,
 * Unregistered series Categorize skin. "base"Empty series omitted.
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
