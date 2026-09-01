// Theme Studio token Registry (browser native ES module, not entering the build pipeline).
//
// Truth table:
// - Color contract:src/styles/themes/_contract.css(Required 20+1）
// - L3 Shape/Layout/Material: src/styles/themes/_component-defaults.css
// tests/studio-token-registry.test.mjs lock mutex. "Registry tokens must exist
// src/styles"——Update here on contract evolution; prevents silent drift.

export const TOKEN_GROUPS = [
  {
    id: "contract",
    label: "color contract (required for skin)",
    tokens: [
      { name: "--bg", type: "color", hint: "Page background color." },
      { name: "--paper", type: "color", hint: "纸面/卡片" },
      { name: "--surface", type: "color", hint: "Overlay surface" },
      { name: "--ink", type: "color", hint: "Body text" },
      { name: "--muted", type: "color", hint: "次要文字" },
      { name: "--line", type: "color", hint: "描边/Separator" },
      { name: "--accent", type: "color", hint: "Accent color" },
      { name: "--accent-weak", type: "color", hint: "Emphasize weak base" },
      { name: "--selection", type: "color", hint: "选区" },
      { name: "--danger", type: "color", hint: "Danger" },
      { name: "--danger-weak", type: "color", hint: "Dangerous weak base" },
      { name: "--ok", type: "color", hint: "成功" },
      { name: "--ok-weak", type: "color", hint: "Success weak base" },
      { name: "--warn", type: "color", hint: "Warning/Highlighter" },
      { name: "--warn-weak", type: "color", hint: "Warning weak background" },
      { name: "--gold", type: "color", hint: "金/Seal/Stamp" },
      { name: "--gold-weak", type: "color", hint: "Metal-weak base." },
      { name: "--chrome", type: "color", hint: "Dark border" },
      { name: "--reader-page", type: "color", hint: "Bottom of reading page." },
      { name: "--shadow-color", type: "color", hint: "Shadow base color" },
    ],
  },
  {
    id: "shape",
    label: "L3 · Component shape",
    tokens: [
      { name: "--btn-radius", type: "text", hint: "Primary button corner radius" },
      { name: "--btn-primary-bg", type: "color", hint: "主按钮底" },
      { name: "--btn-primary-fg", type: "color", hint: "Primary button text" },
      { name: "--panel-radius", type: "text", hint: "Dialog shell corner radius" },
      { name: "--stage-veil", type: "text", hint: "Paper stage veil thickness %" },
      { name: "--ornament-line", type: "color", hint: "Decoration stroke" },
    ],
  },
  {
    id: "layout",
    label: "L3 · Layout Density",
    tokens: [
      { name: "--shell-pad-inline", type: "text", hint: "Corridor padding" },
      { name: "--shell-pad-inline-narrow", type: "text", hint: "Narrow screen corridor" },
      { name: "--header-width", type: "text", hint: "top bar width" },
      { name: "--header-gap-bottom", type: "text", hint: "top bar bottom margin" },
      { name: "--stage-width", type: "text", hint: "Paper stage width" },
      { name: "--stage-pad", type: "text", hint: "Paper stage padding" },
      { name: "--stage-shadow", type: "text", hint: "Paper stage shadow" },
    ],
  },
  {
    id: "mat",
    label: "L3 · Ambient material",
    tokens: [
      { name: "--mat-fiber", type: "color", hint: "纤维 1" },
      { name: "--mat-fiber-2", type: "color", hint: "纤维 2" },
      { name: "--mat-edge", type: "color", hint: "Dim corridor" },
      { name: "--mat-center", type: "color", hint: "Brighten center" },
    ],
  },
];

/** Skin file required. token (for export validation), must match _contract.css */
export const REQUIRED_TOKENS = TOKEN_GROUPS[0].tokens.map((t) => t.name);

/**
 * Select parse table:iframe Clicked element matches first rule from inside out.
* Panel focuses it. "Jurisdiction" tokenDecoration layer special: M3 uses image generation flow.
 */
export const SELECTOR_TOKEN_MAP = [
  { match: ".app-button", label: "Primary button", tokens: ["--btn-primary-bg", "--btn-primary-fg", "--btn-radius", "--accent"] },
  { match: ".decor-quote", label: "inscription banner (decorative)", tokens: ["--ornament-line", "--gold", "--paper"] },
  { match: ".decor-layer", label: "Decoration layer (M3 image generation slot)", tokens: [], decorSlot: true },
  { match: ".home-paper-stage", label: "Paper stage", tokens: ["--stage-veil", "--stage-width", "--stage-pad", "--stage-shadow", "--paper"] },
  { match: ".app-shell-header", label: "顶栏", tokens: ["--header-width", "--header-gap-bottom", "--ink", "--paper"] },
  { match: "button, [role='button']", label: "Normal/Controls", tokens: ["--accent", "--ink", "--paper", "--line"] },
  { match: "input, textarea, select", label: "Input parameters:", tokens: ["--paper", "--ink", "--line", "--muted"] },
  { match: "h1, h2, h3, h4", label: "Title", tokens: ["--ink"] },
  { match: "p, span, li", label: "正文/Subtext", tokens: ["--ink", "--muted"] },
  { match: "body", label: "Global Theme", tokens: ["--bg", "--paper", "--ink", "--mat-edge", "--mat-center"] },
];

/** Before export WCAG Key color pair for contrast self-check (foreground, background, Expected level) */
export const CONTRAST_PAIRS = [
  { fg: "--ink", bg: "--paper", label: "正文/纸面", min: 7 },
  { fg: "--ink", bg: "--bg", label: "正文/底色", min: 4.5 },
  { fg: "--muted", bg: "--paper", label: "次要字/纸面", min: 4.5 },
  { fg: "--btn-primary-fg", bg: "--btn-primary-bg", label: "主按钮字/底", min: 4.5 },
  { fg: "--danger", bg: "--paper", label: "危险字/纸面", min: 3 },
];
