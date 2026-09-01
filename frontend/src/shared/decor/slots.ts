// Anchor decoration.slotregistry: decoration theme's"Layout contract"。
//
// Design principles (docs/theme-system/DECOR_PACKS.md）：
// - Functional UI is always DOM. Anchor layer only attaches to listed named anchors. Do not invent coordinates.
// - manifest Declare"which asset is attached to slot"，slot Where, size, level determined by
//   Stage CSS (subsequent DecorStageUnified implementation) â Decouple assets from layout.
// - Add anchor = Register here + add location in Stage CSS. Manifest validates auto-release.
//
// Level band (z-index bandspecific values assigned by stage CSS Unified allocation):
//   bg < Functional UI Backplate < mid < Functional UI Content â¦outer edge < fg
//   bg  Full-width background (landscape)/Landscape/Grassland), forever UI Panel covered.
//   mid Midground props (characters/bronze tripod/horse), can be UI Panel partially occluded.
//   fg  Foreground edge trim (floral branch/Dragon carving probe. UI edge),pointer-events: none

export type DecorLayerBand = "bg" | "mid" | "fg";

export type DecorSlotDefinition = {
/** ID referenced by manifest.layers[].slot */
  id: string;
  band: DecorLayerBand;
  /** Approximate area (percentage semantics for documentation only; true values in stage CSS） */
  area: string;
  /** true = Allow compress to feature UI above the edge (only fg Allow nullable true） */
  overUi: boolean;
/** true = this slot supports vertical layout/horizontal text (inscription banner) */
  textCapable?: boolean;
};

/**
 * Anchor truth table. Around the central library panel. + Full-width background + Inscription slot.
* Three concept drafts (Chinese style/garden/decorative elements e.g. grassland) map to these anchors.
 */
export const DECOR_SLOTS: readonly DecorSlotDefinition[] = [
  { id: "backdrop", band: "bg", area: "全屏 100%×100%", overUi: false },

  // Left/right wings: concept draft figures, dragon carvings, porcelain vases, horses, scaffolding
  { id: "left-top", band: "mid", area: "Top Left 0~25% × 0~40%", overUi: false },
  { id: "left-bottom", band: "mid", area: "Bottom Left 0~25% × 55~100%", overUi: false },
  { id: "right-top", band: "mid", area: "Top Right 75~100% × 0~40%", overUi: false },
  { id: "right-bottom", band: "mid", area: "Bottom right 75~100% × 55~100%", overUi: false },

  // Top center: arched trim above navigation/Butterfly/bird
  { id: "top-center", band: "mid", area: "Top 30~70% × 0~12%", overUi: false },

  // Hero: top banner figure (reading girl from three concept drafts)/Boy
  { id: "hero", band: "mid", area: "Top banner area 40~70% × 10~30%", overUi: false },

  // Foreground edge overlay: floral branches, tassels, and fringes extending into panel edges
  { id: "edge-left", band: "fg", area: "Left edge 0~12% × Full Height", overUi: true },
  { id: "edge-right", band: "fg", area: "Right Edge 88~100% × 全高", overUi: true },

// Bottom-right foreground position: fg version of right-bottom â Need character/props to render above panel
  { id: "right-bottom-fg", band: "fg", area: "右下 75~100% × 55~100%", overUi: true },

// Banner inscription ("Know where it comes from, know where it goes" Vertical text position
  { id: "quote", band: "mid", area: "Top Right 82~98% × 5~35%", overUi: false, textCapable: true },
] as const;

export type DecorSlotId = (typeof DECOR_SLOTS)[number]["id"];

const SLOT_MAP: ReadonlyMap<string, DecorSlotDefinition> = new Map(
  DECOR_SLOTS.map((s) => [s.id, s]),
);

export function getDecorSlot(id: string): DecorSlotDefinition | undefined {
  return SLOT_MAP.get(id);
}

export function isDecorSlotId(value: unknown): value is DecorSlotId {
  return typeof value === "string" && SLOT_MAP.has(value);
}
