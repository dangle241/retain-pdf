# Decoration pack (Decor PacksContract

> Status: Contract + Image version stage deployed (three Engine not implemented.model Layer temporary exit fallback Figure).
> Code truth value:`frontend/src/shared/decor/{slots,contract,stage-plan}.ts` · `DecorStage.tsx`
> slot Location:`frontend/src/styles/core/decor-stage.css` · Demo package:`frontend/decor/jiangnan/`
> Tests: `frontend/tests/decor-contract.test.mjs` Â· `tests/decor-stage.test.mjs`

## What is it?

Existing theme system (`data-theme` + semantic CSS Variable) manages only **Color scheme**. Decorator package overlays layer on top.
**Optional visual world**full-screen background illustrations, layered props, clickable animations 3D Models, inscription banners——
i.e., in the concept draft"Chinese Style/Gardens/Grassland"Theme.

```
Decoration Theme = Color theme (themes/<id>.css)  ← Existing system, leave unchanged.
+ Decoration Pack   (decor/<pack>/manifest.json + assets)
```

`registry.ts`'s `ThemeDefinition.decorPack` points to package name. **No decorPack means no skin
（classic / nightZero decoration, zero extra downloads.**——three.js chunk Decorate only if included. model layer time
Dynamic import.

## Principle 1: Functionality UI Forever DOM

Keep library grid, top bar, search, buttons. React/DOMDecoration layer attaches only to**Named anchor (slot）**
on, divided into three hierarchical bands:

```
z-index low → high
  bg   Full-width background illustration          Always be UI Panel covered)
---- Functional UI Backplane (semi-transparent --surface) ----
  mid  Props: character/Bronze tripod/horse (can be UI Panel partially obstructed)
---- Functional UI Content ----
  fg   Foreground edge crop: flower branch/tassel    (pressed under UI On the edge,pointer-events: none）
```

## Anchor map (slots.ts truth value)

```
┌─────────────────────────────────────────────┐
│ left-top      top-center        right-top   │
│                  hero              quote    │
│ e┌─────────────────────────────────────┐e   │
│ d│                                     │d   │
â gâ         Functional UI (Library Panel)          âg   â
│ e│                                     │e   │
│ -│                                     │-   │
│ l└─────────────────────────────────────┘r   │
│ left-bottom                   right-bottom  │
│              （right-bottom-fgLower right foreground position)  │
│              backdropFull Width                │
└─────────────────────────────────────────────┘
```

- slot Where, size, what z-index：**Stage CSS Unified implementation**(TBD DecorStage），
  manifest Declare only."Which asset to attach? slot"Asset-side decoupled from layout-side.
- One slot only attaches one layer. Stacking required. â slots.ts New anchor not found. manifest Human pyramid inside.
- Add anchor = slots.ts Add one. + Stage CSS Add a locate entry; validation auto-passes.

## manifest Example

```jsonc
// decor/guofeng/manifest.json
{
  "version": 1,
  "id": "guofeng",
  "layers": [
    { "type": "image", "slot": "backdrop",    "src": "bg.webp", "parallax": 0.05 },
    { "type": "image", "slot": "left-bottom", "src": "dragon.webp" },
    { "type": "model", "slot": "left-top",    "src": "girl.glb",
      "fallback": "girl.webp", "idleClip": "Breathe", "clickClip": "TurnPage" }
  ],
  "quote": { "slot": "quote", "text": "Understand origin.\nKnow where to go." }
}
```

## Hard rules (validateDecorManifest Force

| Rule | Reason |
|---|---|
| model layer `fallback` required | Degradation chain is a contract: reduced-motion / no WebGL / Low-end device â static image |
| backdrop No Mount 3D | Performance critical; background use. image + parallax Fake as real |
| 3D Layers ≤ 3 | Single Canvas rendererToo many will cause lag. |
| Total layers ≤ 12 | prevent"Fill screen"out of control |
| src Package-relative paths only. | Prohibit `..` / absolute path / http: / data: |
| parallax ∈ [0, 0.2] | Parallax is an accent, not a gimmick. |
| quote Mount only textCapable Anchor missing. Add anchor tags. | Text layout handled by stage. |

## Budget allocation incorrect. Check formula. Fix:contract.ts Constant, pipeline gate disabled

| Item | Limit |
|---|---|
| Single glb (Draco+KTX2 After compression) | 2048 KB |
| Single model triangle | 50,000 |
| Single decorative image (webp） | 512 KB |

AI Production model pipeline: AI Generation â `gltf-transform optimize` (Draco Geometry + KTX2 Texture) â
Budget Access Control (npm scriptexceeds limit, reject storage)→ Animation clip Naming (`idleClip`/`clickClip`
Referenced name must exist in glb）→ Store.

## Interaction model (enforced by stage engine implementation)

- Single full-screen transparent WebGL canvas Carries all model Layer,`pointer-events: none`。
- window Level Monitor click，raycast Hit registered. `clickClip` Animation played only for the object.——
  UI Events and decorations do not interfere with each other.
- `idleClip` Loop;`prefers-reduced-motion` Not loaded at times three, directly use fallback Figure.
- image Layers can be declared. `clickQuote`Overlay a transparent hotspot button on the stage in this layer.
  Only stamp Character Entity Department, restore. `pointer-events`), click the carousel quote bubble,5s Auto-collapse;
  Decoration `<img>` Main body unchanged. `pointer-events: none` + `alt=""`Interactive walkthrough button.

## YAGNI. Why?

1. Place manifest.json + Assets in `decor/<pack>/` (Budget Gate Passed)
2. **Write `ASSETS.md` Asset Specification Document in same directory** (Provide AI per-asset prompts for the tool +
   Size/Composition/Hard color scheme constraints, see template. `decor/jiangnan/ASSETS.md`）
3. `registry.ts` Add corresponding theme `decorPack: "<pack>"`
4. Run `tests/decor-contract.test.mjs` (schema On change + Stage Engine manifest Validation falls back on load.

## Roadmap Position

1. ✅ manifest contract + slot Registry (this document)
2. ✅ CSS Hardcoding Convergence (461→0ratchet baseline `{}`）
3. ✅ Access Control (tests/css-color-literals.test.mjsTesting is the gate.
4. ⬜ L3 Component token(Button/Card style skinnable)——Feedback from stage practice token Checklist
5. ✅ DecorStage Image version (jiangnan Demo pack: Fog Mountain/Bamboo Branch/Cinnabar Seal/Vertical inscription;
   parallax rAF Throttle;<1100px Safe area: background only.classic Zero-overhead package-free theme)
6. ⬜ three Engine + first 3D Item + Asset pipeline gate script
