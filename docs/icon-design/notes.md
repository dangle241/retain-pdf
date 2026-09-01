# Icon delivery instructions (notes）

## Specifications

- Canvas: All `viewBox="0 0 24 24"`Graphic Security Edge Agreement 2px
- Stroke: round line cap/Corner (round); **Main suite 1.8** Logo class `badge-*`) and `action-add-pdf` use **2.0** (Smaller size, clearer)
- Color: Monochrome `currentColor`No hard-coded color values; a few accent elements (FAB Dot matrix, keyboard keys, play triangle, star, keyhole, exclamation dot) use `fill="currentColor"` Solid
- Dark background: white pressed./Dark two-tone background `preview/index.html` Verify

## Reuse relation (same shape, different names; output one copy per list name)

| Same shape | File |
|----------|------|
| Document + Dog-ear | `reader-mode-source` = `reader-download-source` |
| Text + A | `reader-mode-translated` = `reader-download-translated` = `book-translate` (`badge-translated` Same shape but 2.0 Stroke) |
| Double column | `reader-mode-compare` = `reader-download-compare` = `book-compare` |
| Gear | `action-settings` = `collection-manage` |
| Circle i | `settings-about` = `toast-info` |
| Warning Triangle | `badge-failed`（2.0）= `toast-warning`（1.8） |
| Circle arc draw. Use CSS border-radius. | `badge-processing`（2.0）= `toast-loading`（1.8） |
| cross | `reader-close` = `dialog-close` |

If later changing a style, sync same-name family files or reference the same copy.

## Icon style descriptions

- `nav-library`Two books upright. + one leaning (11°）+ Baseline Bookshelf
- `nav-collections`Three books stacked (wider bottom, narrower top).
- `nav-favorites`Bookmarks (do not use heart shape, follow §7）
- `reader-fab`：3×3 Solid dot matrix (menu-like, follows list prompts)
- `reader-notes` / `reader-note-add`Lower-right corner-fold note, latter with embedded plus.
- `badge-processing`：288° Arc,CSS `transform: rotate` Center rotate complete. loading
- `shelf-empty-favorites`Bookmarks + Little Star (Empty State Decoration)
- `shelf-empty-collection` / `shelf-batch-collection` Folder: / Folder + Plus
- `settings-api`Key (credentials);`settings-glossary`Open book;`settings-about`Circle i

## Lottie

- `anim-processing.json`：64×64、30fps、60 Frame (2s "loop),"288° Constant-speed arc rotation
- Neutral gray. `#6B7280`（JSON inner `c.k`，lottie Cannot use directly. currentColor, change color as needed during integration)
- Static first frame readable (notched arc)`prefers-reduced-motion` Frame freeze OK.

## Preview

- `preview/index.html`: all SVG in 16/24/48px White/Deep overview (generated from root directory `build_preview.py`)
- `preview/contact-sheet.png`Screenshot of the above page.
- `preview/anim-processing-frames.png`: Lottie frame 0/15/30 Freeze Frame
