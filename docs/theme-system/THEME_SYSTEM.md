# RetainPDF Theme skin system (design spec)

**Status:** Design + Infrastructure deployed. "Jiangnan courtyard" skin switchable trial.
**Date:** 2026-07-21
**Goal:** One set first. **Extensible skin architecture**, then gradually replace hard-coded colors with semantic tokens.

---

## 1. Why「System」Instead of directly changing the color

Current problem:

1. Color truth value in `tokens.css`. Pages hardcode strings. Refactor: extract to i18n JSON. Use next-i18next. ponytail: ceiling: 100+ pages. Upgrade: custom loader if bundle size critical. `#1d1d1f` / `#f5f5f7` etc.
2. Single only. `:root` cannot coexist. "Monochrome restraint" and "Jiangnan Courtyard" are two styles.
3. shadcn Variable (`--primary` etc.) mapped to project token——**Skinning only requires changing the underlying layer. token**, component layer remains unchanged.

Principle:

> **Component accepts semantic names only (`--bg` / `--accent` / `--danger`…Skin only assigns semantic names.**

---

## 2. Semantic color palette stable. Use CSS variables. Define once. Apply globally.

| Token | Role | Product semantics |
|-------|------|----------|
| `--bg` | Background | Courtyard. / Gray brick floor |
| `--paper` | Card / On paper | Rice paper, floating surface |
| `--surface` | Translucent glass surface | Top/bottom bar frosted glass. |
| `--ink` | Primary text / High contrast | Ink |
| `--muted` | Secondary text | Light ink |
| `--line` | Stroke / Split | Grout lines, faint lines |
| `--accent` | Primary button / Link / Focus | **Verdigris. / Azure-green beams and purlins** |
| `--accent-weak` | Select weak bottom | Pale teal halo |
| `--selection` | Current page, selected document | Teal-green decorative painting, light base (new) |
| `--danger` | Error / Destructive operation / Emphasize annotation | Cinnabar |
| `--danger-weak` | Weak error base. | Cinnabar blush |
| `--ok` | Success | Retain green or moss-green. |
| `--warn` | Warning | Amber |
| `--gold` | Advanced Model / Important status | Gilding (new) |
| `--chrome` | Top bar dark. / Dark mode background | Black roof tiles (new) |
| `--reader-page` | PDF Page background. | Rice White (new, reader) |

shadcn Continue layer

- `--background` ← `--bg`
- `--foreground` ← `--ink`
- `--primary` ← `--accent`
- `--destructive` ← `--danger`
- ... (see `shadcn-theme.css`)

**Forbidden**: Direct skin edits. Use shadcn names; project semantics use tokens only.

---

## 3. Skin list

Built-in skin (registry) `THEME_REGISTRY`Settings → Appearance Group view):

| id | Group | Description |
|----|------|------|
| `classic` | light | Default black, white, gray |
| `jiangnan` | accent | grey brick · Xuan paper · Verdigris · Cinnabar |
| `seacliff` | accent | Cape Mist Blue · Sea Stone Cyan |
| `night` | dark | Night on Dark Tiles (`html.theme-dark`） |

Add skin: 3 Step, see **[ADDING_A_THEME.md](./ADDING_A_THEME.md)**。

Jiangnan Color Palette Details:`skins/jiangnan.md`。

---

## 4. Runtime Mechanism

### 4.1 Mount Point

```html
<html data-theme="jiangnan">  <!-- or classic -->
```

CSS：

```css
:root,
[data-theme="classic"] { /* classic values */ }

[data-theme="jiangnan"] { /* Override semantic tokens token */ }
```

### 4.2 Persist

- Key：`localStorage["retainpdf.theme"]` = `"classic" | "jiangnan" | ...`
- Start: Read early storage and write to `<html data-theme>` to avoid FOUC
  - Script:`frontend/src/shared/theme/boot-theme.js`(each HTML Inline or at entry's first line. import）

### 4.3 Switch API Code

```ts
import { getTheme, setTheme, listThemes } from "./shared/theme/theme";

setTheme("jiangnan"); // write storage + document.documentElement.dataset.theme
```

Settings page to be added later. "Appearance": Just add one line to connect; no need to modify business components.

---

## 5. File layout

```
docs/theme-system/
  THEME_SYSTEM.md          ← This document
  skins/
    jiangnan.md            ← Jiangnan Color Palette Guide (Design)

frontend/src/styles/
  tokens.css               ← Semantic Contract + Default Import classic
  themes/
    classic.css            ← Current default skin tone
jiangnan.css           â Jiangnan Courtyard
  shadcn-theme.css         ← Keep mapping semantics. token(skin unrelated)

frontend/src/shared/theme/
  theme.ts                 ← get/set/list + storage
  boot-theme.ts            ← Sync write data-themeAnti-flicker
```

---

## 6. Implementation phase (recommended)

| Phase | Content | Risk |
|------|------|------|
| S0 ✅ | Semantic token layering + classic / jiangnan Two sets CSS + setTheme API | Low |
| **S1** ✅ | Set "Appearance" tab + Theme card; three pages entry `bootTheme()` | Low |
| S2 ✅ | Batch remove neutral hardcoding → tokenSelected state path --accent | Medium |
| S3 ✅ | Registry multi-skin architecture;night/seacliffAppearance group UI | Medium |
| **S4** | Clear remaining. hexBusiness selected state unified `--selection` | Medium |
| **S5** | Icons/Animations follow theme; community/Import custom skin (optional) | high |

**Do not** perform Major visual overhaul in S0; default remains classicJiangnan skin relies on `data-theme` trial.

---

## 7. Try Jiangnan Skin (Dev)

Browser console:

```js
localStorage.setItem("retainpdf.theme", "jiangnan");
document.documentElement.dataset.theme = "jiangnan";
```

Or:

```js
// If integrated shared/theme
import { setTheme } from "/…"; // Settings page post-build.
```

Restore defaults:

```js
localStorage.setItem("retainpdf.theme", "classic");
document.documentElement.dataset.theme = "classic";
// Or removeItem + removeAttribute
```

---

## 8. Relationship with icon system

- Keep icon **monochrome currentColor**. Change skin only modify CSS variables. tokenIcon auto-follow parent color. `--ink` / `--accent`.
- Cinnabar annotations, gilded status: use `--danger` / `--gold` to apply color to badge. Do not hardcode values in SVG.

---

## 9. Decision log

| Decision | Choice | Reason |
|------|------|------|
| Switching method | `data-theme` Properties | Independent of React. Takes effect on first screen. Pure CSS selectors |
| Default Skin | classic | Do not break existing visuals or test screenshots. |
| Brand primary color | `--accent` Turns green with skin | Main button/Unify focus handling. accent |
| Danger | Each skin fine-tunable; semantics unchanged. danger | Delete/Keep failures identifiable. |
| Hardcoded cleanup | Installments | Replace all instances. diff too large |

---

## 10. Summary

**Skin = Use same semantics. CSS Variable color change; apply = Semantic variables only.**
Jiangnan Courtyard is the first set.「There is a story.」Skin;classic Fallback
