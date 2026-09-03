// Decor slot registry: the "layout contract" for decor themes.
//
// Design principles (docs/theme-system/DECOR_PACKS.md):
// - The tools UI is always in the DOM; decor layers can only attach to the
//   named slots below, never create their own coordinates.
// - manifest declares "which slot an asset hangs on"; slot position, size,
//   and z‑level are unified by stage CSS (DecorStage) — asset side decoupled
//   from layout.
// - Adding a new slot = register it here + add one CSS placement rule in the
//   stage styles; manifest validation automatically permits it.
//
// Z‑index bands (actual values are set by stage CSS):
//   bg  < tools UI backdrop < mid < tools UI content … edges < fg
//   bg   full‑screen background (landscape/garden/steppe), always under UI panels
//   mid  mid‑ground props (figures, bronze tripods, horses), can be partially
//        obscured by UI panels
//   fg   foreground edges (branches, dragons reaching into UI edges),
//        pointer‑events: none

export type DecorLayerBand = "bg" | "mid" | "fg";

export type DecorSlotDefinition = {
  /** Slot id referenced by manifest.layers[].slot */
  id: string;
  band: DecorLayerBand;
  /** Approximate area (percentage semantics are only documentation; actual values in stage CSS) */
  area: string;
  /** true = allowed to overlap tool UI edges (only fg‑band slots may be true) */
  overUi: boolean;
  /** true = this slot supports vertical/horizontal text (for inscription banners) */
  textCapable?: boolean;
};

/**
 * Slot truth table. Covers the area around the central library panel,
 * full‑screen background, and inscription positions.
 * Decor elements from all three concept mockups (Chinese, garden, steppe)
 * map to this slot set.
 */
export const DECOR_SLOTS: readonly DecorSlotDefinition[] = [
  { id: "backdrop", band: "bg", area: "Full screen 100%×100%", overUi: false },

  // Left/right wings: figures, dragon carvings, vases, horses, eagle stands from concept mockups
  { id: "left-top", band: "mid", area: "Top-left 0~25% × 0~40%", overUi: false },
  { id: "left-bottom", band: "mid", area: "Bottom-left 0~25% × 55~100%", overUi: false },
  { id: "right-top", band: "mid", area: "Top-right 75~100% × 0~40%", overUi: false },
  { id: "right-bottom", band: "mid", area: "Bottom-right 75~100% × 55~100%", overUi: false },

  // Top center: arched ornaments / butterflies / birds above the navigation
  { id: "top-center", band: "mid", area: "Top 30~70% × 0~12%", overUi: false },

  // Hero position: characters in the top banner area (reading girl/boy from the three mockups)
  { id: "hero", band: "mid", area: "Top banner area 40~70% × 10~30%", overUi: false },

  // Foreground edges: branches, tassels, and pendants reaching into panel edges
  { id: "edge-left", band: "fg", area: "Left edge 0~12% × full height", overUi: true },
  { id: "edge-right", band: "fg", area: "Right edge 88~100% × full height", overUi: true },

  // Bottom‑right foreground: fg version of right‑bottom — for cases where figures/props need to overlap the panel
  { id: "right-bottom-fg", band: "fg", area: "Bottom-right 75~100% × 55~100%", overUi: true },

  // Inscription banner ("知其所来 明其所往"): vertical text position
  { id: "quote", band: "mid", area: "Top-right 82~98% × 5~35%", overUi: false, textCapable: true },
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



