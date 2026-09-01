# 「Plain paper · Jiangnan」Decoration pack —— Art asset generation instructions

> This file is for AI Generation tool (text-to-image) / text-to-3D） + Maintainer to review asset spec.
> Replace same-named files in this directory with generated assets to apply; no code changes. Only needed for new layers.
> Change manifest.json. See format contract in docs/theme-system/DECOR_PACKS.md.
> Three in the current directory. SVG Hand-drawn vector finalize contract-allowed svg format); if later switching to
> For text-to-image bitmaps, generate webp with the prompts below and replace with same name.

---

## 1. Theme ethos (all assets comply)

Imagery Jiangnan Gardens · Misty distant mountains · Plain paper · Scholar's study. Restrained, negative space, low saturation.
Forbidden Cyberpunk neon noir aesthetic / Modern elements, crowded composition.

Colors must come from the theme. token Use (hardcoded colors allowed in assets; hue must fall within this set):

| token | Value | Usage |
|---|---|---|
| Paper base `--paper` | `#fbfaf8` | Highlights / Whitespace |
| Lime base `--bg` | `#f1f0ed` | Background tone |
| Teal-green. `--accent` | `#2a5f57` | Bamboo, mountain depths (use faded tones) |
| Ink `--ink` | `#1b1b1d` | Use sparingly as accent, not broadly. |
| Cinnabar --danger family | #c23b32 → placeholder usage #b0493f | Seal only/Embellish |

**Contrast red line**All decorations placed under functional UI UI Below, the feature panel is ~88% Opaque paper color.
Background asset overall brightness must ≥ `#dde2dd`Panel shows dirt otherwise.

## 2. General Technical Specifications (Contractual mandate; exceed limits and access denied)

- Format:`webp`Preferred./ `png` / `svg` / `avif`；**Props must have transparent backgrounds**
- Single file ≤ 512 KB (IMAGE_BUDGET_KB, contract.ts truth value)
- Color space sRGBBitmap per table below."Output Dimensions"Output (contains 2x Remaining)
- Naming and manifest.json's src consistent; replace = overwrite

## 3. Per-asset specification + Generate prompt

### 3.1 `bg.svg` → Recommend switching to `bg.webp`（backdrop Full-width background

- Generate image:**3200×1800**（16:9，object-fit: coverNarrow screen crop sides
- Composition hard constraints:**Top 60% Approach whitespace**(fog/Feature panel compressed here.
  Mountains concentrate in**Bottom 1/3**Darken corners only. `#93aa9d`
- Prompt:
> Jiangnan distant mountains in ink-and-wash style, morning mist, bluish-gray tones #93aa9d to #f1f0ed,
  > Three layers of mountain shadows from light to dark. Upper two-thirds of frame is misty blank space. Minimalist negative-space composition.
  > Low saturation. No people. No buildings. Horizontal. 16:9

### 3.2 `bamboo.svg` → `bamboo.webp`（left-bottom Bamboo branch)

- Output: 600×840 (5:7 portrait orientation, transparent background
- Composition hard constraint: subject**Align left bottom. Simplify layout.**Growth (slot Anchor at screen bottom-left.
  Transparent breathing space on right and top.2-3 bamboo pole + Sparse leaves; avoid density.
- Prompt:
  > Two or three ink bamboo stalks extend diagonally from the bottom-left corner of the frame, in ink wash style with a blue-green tone (#4c7466、#5d8273），
  > Sparse blank space, bamboo leaves in small clusters of three to five, transparent background, small Chinese painting texture.

### 3.3 `seal.svg` → `seal.webp`（right-bottom Book seal)

- Output: 280×280 square, transparent background.
- Hard constraint: single seal fills frame. 85%Tilt slightly right. 2-3° more natural
- Prompt:
  > A cinnabar book-collecting seal, seal-script style, dark red (#b0493fBorder radius.
  > Seal inscription can be"Library"Or abstract seal-script motifs, subtle hand-stamped edge imperfections, transparent background.

### 3.4 Inscription (quote）—— Not an image asset.

Vertical text is rendered directly by the stage (change manifest.json's quote.text just that),
Do not generate text image. Current copy: 「10k books / Roam through millennia」.

## 4. Empty anchor (place new assets here)

按 manifest Add line `{ "type": "image", "slot": "<id>", "src": "<文件>" }` Just:

| slot | Screen position | Drawing recommended. | Suitable Content |
|---|---|---|---|
| `hero` | Top banner area (original"Continue reading."bit) | 440×520 Transparent | Reading Character (Concept Draft Girl)/Youth) |
| left-top / right-top | Left, right upper wings | 560×720 transparent | Weeping branches, lanterns, flying birds |
| top-center | Above navigation | 1040×220 transparent | Arch-shaped ornaments, butterflies |
| `edge-left` / `edge-right` | Edge case ignored. Add when needed. UI(only floating UI upper layer) | 280×1920 Transparent | Flower branch extending into panel——**Must be extremely sparse**, middle 80% Leave blank |

## 5. 3D Assets (three Enable after engine integration. Specs defined here.

- Format .glb, Draco + KTX2 after compression ≤ 2 MB, ≤ 50,000 triangle faces (contract.ts truth value)
- Animation clip embed and name, in manifest idleClip for cycle standby / clickClip for quote (one-click)
- Must configure same-name fallback image (manifest fallback required — for image stage / low-end device /
  reduced-motion All render this image, so fallback To achieve the above itself. 2D Asset quality standards
- Pipeline: AI generation → gltf-transform optimize → budget check → receive

## 6. Accept replace/Run after adding assets.

```bash
cd frontend
# manifest contract + Stage plan (after adding layer / changing manifest)
node --import ./tests/helpers/register-jsx.mjs --test tests/decor-stage.test.mjs
# Volume gate (512KB）
find decor/jiangnan -type f \( -name '*.webp' -o -name '*.png' -o -name '*.svg' -o -name '*.avif' \) -size +512k
# ↑ Has output = Over budget. Compress before committing.
```

Browser visual inspection: switch topic to "Plain Paper", confirm <1100px Narrow screen: background only.
Function panel text readability unaffected by background.
