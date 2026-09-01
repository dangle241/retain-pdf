# RetainPDF Icon / Animation requirements

**Usage:** Generate images per checklist for you (or designer); product will gradually replace existing ones. Lucide Wireframe SVG Inline path。  
**Date:** 2026-07-21
**Style Reference:** Lightweight reading product. Prefer. Apple / Academic Tools——**Thin lines, rounded corners, minimal decoration**Follow primary color UI（`currentColor`), do not hardcode large black blocks.

---

## 1. Delivery agreement (follow this)

### 1.1 Static icon (UI Line label)

| item | requirement |
|----|------|
| format | **SVG** preferred (vector); optional attachment. 24/48/96 PNG preview |
| Canvas | **24×24** viewBox(unified); provide separate variants for key entry points **32×32 / 48×48** Variant |
| stroke | suggested **1.6â2.0** visual thickness circle cap mismatch. fix: use consistent styles. round) |
| Color | **Monochrome**Use `currentColor` / `#000` Stroke only. We will CSS change color in CSS |
| margin set wrong. Correct. | Add padding around graphic. **2px** Safe margins prevent edge clipping. |
| Naming | lowercase kebab-case, see file names below |
| Place | Place in this directory's `deliverables/`(you can create it too), for example:`docs/icon-design/deliverables/nav-library.svg` |

### 1.2 Dynamic icons (optional bonus)

| item | requirement |
|----|------|
| format | **Lottie JSON** (preferred, project already has lottie-web). **APNG / Short loop WebM** |
| Duration | Loop **1–2s**Processing class too long |
| size | export logic **64Ã64 or 128Ã128** transparent background |
| naming | `anim-<usage>.json`, such as `anim-processing.json` |
| note | avoid heavy particles; display tiny in status card. |

### 1.3 Existing animations (replaceable; no need to redo items outside the list)

Existing Lottie in `frontend/src/assets/animations/`:

| file | purpose (pipeline stage) |
|------|------------------|
| `pdf_upload_Lottie.json` | upload |
| `ocr_Lottie.json` | OCR |
| `deepseek_lottie.json` | model |
| `typst_rendering.json` | typesetting / rendering |
| `pdf_download_Lottie.json` | download / output |

If you want "smoother animations", prioritize changing these 5 + provide source text. **P0 Dynamic** is sufficient.

---

## 2. Priority overview

| priority | description |
|--------|------|
| **P0** | daily view: top bar tab, bottom bar, reader mode/close/FAB card status badge |
| **P1** | Bookshelf actions, toolbar, empty state, settings entry |
| **P2** | Toast / general dialog close, detail decoration |

---

## 3. P0 — Must do first (navigation + Reader.

### 3.1 Home top bar TabThree-piece set, unified style.

| file name suggestions | semantics | UI copy | current rough form | size scenario |
|------------|------|----------|--------------|----------|
| `nav-library.svg` | library / bookshelf | library | spines side by side | 16â18px inline |
| `nav-collections.svg` | collection / book stack folder | collection | layers stack | same as above |
| `nav-favorites.svg` | favorites / bookmark excerpt | favorites | bookmark | same as above |

**Design Tip:** Three aligned side-by-side on white pill ；selected state becomes white outline,**Deep down clarity maintain. Simplify further.**。

### 3.2 Homepage footer

| file name | semantics | copy | current |
|--------|------|------|------|
| `action-add-pdf.svg` | add / upload PDF | add PDF | bold **+** |
| `action-settings.svg` | settings | settings | gear |

Optional: `action-search.svg` (decorative element left of search box, currently plain input).

### 3.3 Reader top bar mode (group of three)

| file name | semantics | copy | current lucide |
|--------|------|------|-------------|
| `reader-mode-source.svg` | single column | original | FileText |
| `reader-mode-translated.svg` | single column | translation | Languages |
| `reader-mode-compare.svg` | Side-by-side | Side-by-Side Reading | Columns2 |

### 3.4 Reader operations

| file name | semantics | copy / scenario | current |
|--------|------|-------------|------|
| `reader-close.svg` | close / back to home | close | X |
| `reader-fab.svg` | Floating tool button main icon | Tools Menu | Menu Feel / Dot matrix acceptable. |
| `reader-notes.svg` | annotation list | annotations | StickyNote |
| `reader-download.svg` | download entry | download | Download |
| `reader-download-source.svg` | download source PDF | original | FileText |
| `reader-download-translated.svg` | translate PDF | translation | Languages |
| `reader-download-compare.svg` | against PDF | comparison | Columns2 |
| `reader-note-add.svg` | annotate selection | add annotation | StickyNote |
| `reader-shortcuts.svg` | keyboard shortcuts | shortcuts | Keyboard |

### 3.5 Bookshelf card status badge (small,11–14px）

| file name | semantics | status copy direction | current key |
|--------|------|--------------|----------|
| `badge-archive.svg` | Collection Only / Untranslated | Inventory | archive |
| `badge-translated.svg` | translated | translated | languages |
| `badge-processing.svg` | processing | in progress | loaderTransferable |
| `badge-failed.svg` | failed | failed | alert |
| `badge-queued.svg` | queued | queued | clock |

**Dynamic priority:** `anim-badge-processing.json` (replace CSS spin loader).

---

## 4. P1 — Bookshelf and empty state

| file name | semantics | location |
|--------|------|----------|
| `shelf-continue-book.svg` | Continue reading cover placeholder | Continue Reading |
| `shelf-empty-favorites.svg` | no favorites yet | favorites tab empty state |
| `shelf-empty-collection.svg` | Empty Collection | Collection cover stack empty |
| `shelf-view-grid.svg` | Grid View | Toolbar |
| `shelf-view-list.svg` | list view | toolbar |
| `shelf-batch-select.svg` | batch select | toolbar |
| `shelf-batch-delete.svg` | Batch Delete | Batch Bar |
| `shelf-batch-collection.svg` | add to collection | batch bar |
| `book-read.svg` | Read original / Eyes | List Row, Details |
| `book-compare.svg` | comparison reading | card actions |
| `book-translate.svg` | start translation | details / card |
| `book-cover-fallback.svg` | No cover placeholder | Card Cover |
| `upload-lock.svg` | No credentials for access control | Upload area |
| `collection-manage.svg` | Manage Collections | Collection Card Gear |

### Settings Hub (Settings Hub Three columns)

| file name | semantics |
|--------|------|
| `settings-api.svg` | API / credentials |
| `settings-glossary.svg` | glossary |
| `settings-about.svg` | about / updates |

---

## 5. P2 — System and Feedback

| file name | semantics | current |
|--------|------|------|
| `toast-success.svg` | Success | CircleCheck |
| `toast-info.svg` | "Info": "Info": "Info" but if it's a heading, "Information" might be better. But UI labels favor "Info". I'll output "Info".Info | Info |
| `toast-warning.svg` | warning | TriangleAlert |
| `toast-error.svg` | error | OctagonX |
| `toast-loading.svg` | Loading (dynamic) | Loader2 spin |
| `dialog-close.svg` | Close dialog | X |

---

## 6. Recommended priorities "Dynamic" list

If time is limited, only implement these dynamics:

| file name | scenario | description |
|--------|------|------|
| `anim-processing.json` | Processing card / Status card | Gentle spinning or progress ring, loopable. |
| `anim-upload.json` | uploading... | can replace `pdf_upload_Lottie.json` |
| `anim-ocr.json` | OCR Phase | Replaceable with `ocr_Lottie.json` |
| `anim-translate.json` | Translation Phase | Replaceable with `deepseek_lottie.json` |
| `anim-render.json` | Layout phase | Replaceable with `typst_rendering.json` |
| `anim-download.json` | Download complete./Proceed | Replaceable with `pdf_download_Lottie.json` |
| `anim-empty-favorites.json` (Optional) | No favorites | Move bookmarks quietly, no disturbance. |

---

## 7. Visual Consistency Suggestions

1. **Same brushstroke set**site-wide 24 Canvas, similar stroke。  
2. **Semantic shape grouping**：  
- book / page â rounded rectangle + Dog-ear
- translation â text / A Or bilingual bubble
- comparison â double column
- favorites â Bookmark (do not use heart shape, andãLikeãobfuscation)
3. **Status color by UI Colorize**Icons monochrome; failure/Successfully exited outer layer badge Background expression.  
4. **Restrained animations**Read context avoid flicker.`prefers-reduced-motion` Pause animation. Ensure static frame remains intelligible.

---

## 8. Delivery directory structure (place files here)

```
docs/icon-design/
  ICON_BRIEF.md          ← This manual
  deliverables/
    svg/
      nav-library.svg
      nav-collections.svg
      ...
    lottie/
      anim-processing.json
      ...
    preview/             ← Optional: Create an overview. PNG/PDF For review
```

Done, notify file ready. Pick up by filename. `frontend/src/assets/icons/` and replace in the code. Lucide / inline SVG.

---

## 9. Minimum viable package (if you only want to start with 12 item)

Sort by product exposure.**Do these first 12** Enough to swap a version's vibe:

1. `nav-library`  
2. `nav-collections`  
3. `nav-favorites`  
4. `action-add-pdf`  
5. `action-settings`  
6. `reader-mode-source`  
7. `reader-mode-translated`  
8. `reader-mode-compare`  
9. `reader-close`  
10. `reader-notes`  
11. `badge-processing` (+ optional `anim-processing`)
12. `badge-translated`  

Remainder in second batch.

---

## 10. Code status (reference only; no changes)

- Reader: Bulk `lucide-react`（ModeTabs / Fab / Close / Selection）。  
- Homepage: excessive inline styles `<svg>`（TopTabs / BottomBar / Badge / Toolbar）。  
- Brand:`frontend/src/assets/RetainPDF-logo.svg`（Logo Separate, not mandatory within this list's scope.  
- Phase animations: Lottie see Â§1.3.

If you have questions, you can directly `deliverables/` Add `notes.md` Write your naming or variant description.
