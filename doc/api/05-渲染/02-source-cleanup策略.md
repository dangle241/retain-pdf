# source_cleanup Strategy

`render.source_cleanup_strategy` Control how to handle the original before rendering. PDF original text inside.

## Current selectable values

- `pikepdf_text_strip`
- `typst_fill`
- `bbox_text_strip`
- `legacy`
- `redact_restore_formulas`

## Current semantics

- pikepdf_text_strip: default policy. First performs content-stream text-op deletion, then Typst translation block background for visual overlay.
- `typst_fill`: Do not perform physical deletion. Use soft delete only. Typst Background block covers original text.
- bbox_text_strip, legacy, redact_restore_formulas: compatibility aliases, currently behave like pikepdf_text_strip.

## Frontend rules

- Use backend defaults; users need not understand policy details.
- Exposable in debug/advanced settings. `typst_fill`Handles unsuitable deletion policies. PDF。
- Don't treat compatibility aliases as new features. UI Display options.
