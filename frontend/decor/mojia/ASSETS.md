# 「Mohist」 decoration pack — Art asset notes

> File format retained. `decor/jiangnan/ASSETS.md` Template (see contract truth value
> `docs/theme-system/DECOR_PACKS.md`Current package assets:**Final draft**：
> Background: user-provided silk framed scene; props by 10 Transparent Zhang Mo Mechanism Theme PNG Assets
> (1254×1254 RGBA) via ImageMagick trim edges / zoom / composite / came compressed.
> Overwrite same-name assets on replacement; takes effect.

---

## 1. Theme ethos (all assets comply)

Imagery Mohist Workshop · Bamboo scroll volumes · Bronze mechanism · Rules and standards. Upright, restrained, warm and simple.
Forbidden Cyberpunk neon saturation / Modern elements, crowded composition, weapon close-up fills screen.

Color scheme from skin token Get`src/styles/themes/mojia.css`）：

| token | Value | Usage |
|---|---|---|
| Plain silk --paper | #faf8f1 | Highlights / white space |
| Warm silk background --bg | #f2efe8 | Background tone / prop bottom fog |
| Bronze `--accent` | `#4c6658` | Primary emphasis |
| Xuanmo `--ink` | `#26221b` | Primary button bottom / Add finishing touch |
| Bronze gold. `--gold` | `#8f7442` | Small-area accents |

Contrast red line: background placed under ~92% opaque paper panel, overall brightness must be ≥ #dde2dd.

**Placement discipline**Real device on-device inspection:

- Stand/Place only furniture for sitting or lying. bottom anchor (foot on bottom edge of screen for grounding);
  top Anchors only for flying ones (wooden kite).——File top = Floating Sticker
- `hero` Lands in library panel banner area,`top-center` Collides with floating nav.**Disable both anchors**
- Same-side objects"Gallery"Merge into one (one slot Don't scatter as four-corner stickers.

## 2. Generic Technical Specification (Contract Enforced)

- Format: webp (preferred) / png / svg / avif; props must have transparent backgrounds
- Single file ≤ 512 KB (IMAGE_BUDGET_KB, contract.ts truth value)
- Color space sRGB; naming consistent with manifest.json's src; replace = same-name overwrite

## 3. Per-asset specification (current state) + Repro pipeline

Asset source: Mohist Transparent Asset Pack_10Element/*.png; general preprocessing: magick  -trim +repage.
Unified prop blending process:`-modulate 100,90,100` Desaturate + Bottom stack `--bg` Color fog band with gradual fade
Bottom-attached part 220px Too dense. 55%Invalid. bg Bottom fog same language.**No hard drop shadow.**
Anchor shadow faker than prop.`-define webp:alpha-quality=95 -quality 85`。

### 3.1 `bg.webp`（backdrop Full-width background,31 KB）

- Source:**User-provided draft**Silk ground, warm-toned base. + Square key-pattern border + Light ink distant mountains, bottom corners./gears),
  Original Size 1672×941 Translate directly. webp, without secondary processing
- Composition naturally satisfies the contract: upper part. 60% White space, lower light scene, brightness far above red line.

### 3.2 kite.webp (left-top double kite ← asset 07)

- Output: 560×720 transparent; main kite 300 width +170,+60, tilt up 6°), secondary kite 165 width
  （+40,+150, downward 4°) fly into frame from upper right, occupy only upper part of canvas.——
  left-top Unique."Flying things"The anchor to stay (top-center Collision floating navigation, disabled)

### 3.3 master.webp (right-bottom-fg Puzzle Master Solo ← asset 02)

- Output: **600x840** Transparent character height 800, canvas 95%, bottom-right aligned, bottom edge. 220px ground fog grounding.
- was scholar Group member; now single-person zoom per visual inspection requirements; hang **right-bottom-fg**（fg Bring,
  Press on top of the panel, avoid robe corner slipping into panel edge), and bring `clickQuote` two quotes from Mozi
  (Click character carousel: Weak will, no wisdom; faithless, no achievement.) / Promote the benefits of all under heaven; eliminate the harms of all under heaven.

### 3.4 `scholar.webp` / `lantern-lock.webp`(backup, not mounted)

- Two groups images / Under-lamp ingenuity; see specs. git History), remove after physical device inspection; keep file in repo, re-mountable.

### 3.5 boy.webp backup, not mounted as layer. ← asset 01)

- Export image:440×520 Transparent. Hero slot (hero) falls on the library panel banner area,
  Characters will be flattened by the paper surface."Watermark ghosting"——Do not commit mount layer before layout evolution.

### 3.6 gear-btn.webp ("Add" button surface ← asset 03, without manifest)

- Output: 128×125 transparent (40px button surface with 3x margin), gear compact trim, no fogging
- Consumer is the .library-bottom-icon-btn-ornament rule in themes/mojia.css
 *Component AppBottomBar reserved skinning hook), replace the bottom bar"+"Gear face: replace with real gear.
  Hover to rotate 45°not via manifestLayer not entering stage.
- **Note**Theme CSS in data: URI Inline this image (112px q80 Derived version, approx. 8KB），
Image changed? Regenerate inline. Hook triggers on component change. Must
  `npm run build:js` Re-export. bundle**——Run only build:css May occur."Hide skin + No.
  Hook element missing."Blank Button

### 3.7 tools-btn.webp ("Settings" button surface ← asset 06, without manifest)

- Output: 128×128 transparent; theme CSS inline 112px q80 derived version (approx 6KB)
- Consumer gear button: #app-settings-btn's ornament hook; "Settings = Tool rule. Define. Simplify. Test." hover lift

### 3.8 scroll-btn.webp / library-btn.webp / fav-btn.webp top bar tab icon decals ← assets 08 / 11 / 12, without manifest

- Output: uniform 128px transparent; theme CSS inline 96px q80 derived versions (each approx 3KB)
- Consumer: #library-top-tab-{categories,library,favorites}'s
  `.library-top-tab-ornament` Hooks (LibraryTopTabs component reserved),24px Microbleed at the marked location;
  Semantics: Library=Mechanical Bookshelf Bamboo Slips Collection=Bamboo scroll, collection=Incoming Letter Archive
- Note assets 11 / 12 are RGB white background images (non-RGBA); crop before import.
  `-alpha set -fuzz 9% -fill none -floodfill +2+2 white`(once at each corner);
08 before 10 assets are transparent; use directly with -trim.

### 3.9 Inscription (quote) — not an image asset

Vertical text rendered directly by stage. Current copy:「Universal love / Mutual benefit.」(Mozi·Universal Love.

## 4. Empty anchor

| slot | Status | Reason |
|---|---|---|
| hero / top-center | Disable | Lands in feature panel / floating nav, see §1 placement discipline |
| Bottom center (bottom bar sides) | Disabled | Library panel full-height, fills bottom; middle panel obscures content; ghosting; foreground pressure mark on book card resembles sticker. Previously registered for this issue with bottom-center anchor (gear core), reverted after physical inspection rejection. |
| right-top | Empty | Inscription banner exclusively occupies upper right; adding more props causes overlap. |
| edge-left / edge-right | Empty | Foreground edge band; if adding (ornament/chalk line) must be extremely sparse, middle part 80% leave blank |

Asset 05 repeating crossbow / 09 city tower: user framing shot already includes distant view; silhouette plan abandoned. Original image retained for future.
3D Raw materials for chemical or other subjects; source material. 03 Modify Gear"Add"Button face (see §3.6）。

## 5. Acceptance (must run after replacing/adding assets)

```bash
cd frontend
node --import ./tests/helpers/register-jsx.mjs --test tests/decor-stage.test.mjs
find decor/mojia -type f \( -name '*.webp' -o -name '*.png' -o -name '*.svg' -o -name '*.avif' \) -size +512k
# ↑ output means over budget, compress before committing
```

Browser visual inspection: switch theme to "Mohism", confirm <1100px narrow screen: background only.
Function panel text readability is not interfered by background.
