# rendering/analysis/route

## Responsibilities

Single-page route decision layer. Consumes RenderPageProfile, outputs RenderPageRoute.

Only expose routes here. profile fact fields. For example, pseudo PDF
Go? `typst_visual`、hidden text Strip?source cleanup Physically delete characters?
All should be from the same source. page profile Derived, cannot be. overlay/source cleanup Each scans separately
`page_has_large_background_image()` Local checks later.

## Public entry point

- `builder.py`
- `models.py`

## What not to do

- No rescan PDF。
- Do not execute redaction.
- Do not generate Typst.
- Does not alter actual rendering behavior unless explicitly integrated by upper layer. route。

When adding route judgments, keep one judgment per file, e.g. `redaction_route.py`、`background_route.py`。
