// Registry chủ đề: thêm giao diện về sau = thêm một mục + file CSS tương ứng.
// Component chỉ đọc listThemes() / setTheme(), không hardcode danh sách ID giao diện.
// Thiết kế: docs/theme-system/THEME_SYSTEM.md · ADDING_A_THEME.md.

export const THEME_STORAGE_KEY = "retainpdf.theme";
export const DEFAULT_THEME_ID = "classic";

/** Xem trước swatch màu trên trang cài đặt (nhất quán màu chính của giao diện CSS, chỉ dùng làm thumbnail UI). */
export type ThemePreview = {
  bg: string;
  paper: string;
  accent: string;
  ink: string;
  danger: string;
};

export type ThemeGroup = "light" | "dark" | "accent";

/**
 * Dòng chủ đề (chiều dòng sản phẩm, độc lập với nhóm sáng/tối):
 * Giao diện Bách Gia Chư Tử / triều đại / anime… dùng trường series để vào nhóm,
 * Dòng mới = thêm một hàng vào bảng này, panel giao diện tự xuất hiện vùng mới.
 */
export type ThemeSeries = {
  id: string;
  label: string;
  /** Thứ tự vùng, số càng nhỏ càng nằm trước. */
  order: number;
};

export const THEME_SERIES: readonly ThemeSeries[] = [
  { id: "base", label: "Cơ bản", order: 10 },
  { id: "baijia", label: "Bách gia chư tử", order: 20 },
  // Đang lên kế hoạch: { id: "wangchao", label: "Triều đại", order: 30 },
  //         { id: "niji", label: "Anime", order: 40 },
] as const;

export type ThemeDefinition = {
  /** Nhất quán với html[data-theme] / tên file themes/<id>.css. */
  id: string;
  label: string;
  description: string;
  /** Nhóm trên trang cài đặt. */
  group: ThemeGroup;
  /** Thứ tự danh sách, số càng nhỏ càng nằm trước. */
  order: number;
  preview: ThemePreview;
  /**
   * Tên gói trang trí (decor/<tên gói>/manifest.json trong thư mục tĩnh public).
   * Bỏ trống = giao diện phối màu thuần, không trang trí và không tải thêm.
   * Hợp đồng: src/shared/decor/contract.ts · docs/theme-system/DECOR_PACKS.md.
   */
  decorPack?: string;
  /** ID dòng chủ đề (THEME_SERIES), mặc định thuộc dòng cơ bản "base". */
  series?: string;
};

/**
 * Nguồn sự thật registry.
 * Xem các bước thêm giao diện trong docs/theme-system/ADDING_A_THEME.md.
 */
export const THEME_REGISTRY: readonly ThemeDefinition[] = [
  {
    id: "classic",
    label: "Cổ điển",
    description: "Đen, trắng và xám tiết chế; giao diện mặc định",
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
    label: "Giấy mộc",
    description: "Nền xám vôi lạnh · Điểm nhấn xanh lục lam lạnh",
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
    label: "Mặc gia",
    description: "Nền lụa mộc ấm · Cơ cấu đồng xanh",
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
    label: "Xanh sương",
    description: "Nền xanh xám lạnh · Điểm nhấn xanh xám",
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
    label: "Đêm ngói chàm",
    description: "Chế độ đọc nền tối · Đen ngói chàm",
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
  light: "Sáng",
  dark: "Tối",
  accent: "Phong vị",
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
 * Nhóm theo dòng (panel giao diện sử dụng): dòng được sắp theo THEME_SERIES.order,
 * giao diện có series chưa đăng ký thuộc "base"; dòng rỗng không xuất hiện.
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
