# Render Options Contract

This document specifies. Rust API External inbound `render` Parameters. Principles:

- Rust API Parameter contract entry point. Handles defaults, allowed values, and basic validation.
- Python worker Consume only Rust written stage spec, no longer guessing default semantics on its own.
- New rendering options: update here first.`API_SPEC.md`, Rust validation and stage spec Write logic.

## Current field

| Field | Type | Default | Allowed values / Scope | Description |
| --- | --- | --- | --- | --- |
| `render.render_mode` | string | `auto` | `auto`, `overlay`, `typst`, `typst_visual`, `dual` | Render main path.`auto` Handled by Python based on PDF Editability and page feature selection actual mode. |
| `render.compile_workers` | integer | `0` | `>= 0` | Typst Concurrent compilation.`0` Indicates use. worker default strategy. |
| `render.typst_font_family` | string | `Source Han Serif SC` | Unstructured string | Typst Default Chinese font family. |
| `render.pdf_compress_dpi` | integer | `0` | `>= 0` | PDF image compression DPI. `0` Indicates no additional image compression. |
| `render.translated_pdf_name` | string | `""` | Any filename string | Provide source text. PDF Filename. Empty value uses backend default naming. |
| `render.body_font_size_factor` | number | `0.95` | `> 0` and finite | Global body font size scaling. |
| `render.body_leading_factor` | number | `1.08` | `> 0` and finite | Global body line spacing multiplier. |
| `render.font_unify_mode` | string | `role_min` | `role_min`, `off` | Font consistency strategy.`role_min` Normalize roles to stable baseline.`off` Turn off unified but do not turn off fit/Collision/Background rules. |
| `render.source_cleanup_strategy` | string | `pikepdf_text_strip` | `typst_fill`, `pikepdf_text_strip`, `bbox_text_strip`, `legacy`, `redact_restore_formulas` | Default: path-level first. text-op deletion, then visual overlay by Typst background blocks; `typst_fill` Explicitly close deletion. |
| `render.inner_bbox_shrink_x` | number | `0.0` | `>= 0` and finite | Normal bbox Horizontal indent. |
| `render.inner_bbox_shrink_y` | number | `0.0` | `>= 0` and finite | Normal bbox Vertical indent. |
| `render.inner_bbox_dense_shrink_x` | number | `0.0` | `>= 0` and finite | Dense bbox horizontal indent. |
| `render.inner_bbox_dense_shrink_y` | number | `0.0` | `>= 0` and finite | Dense bbox vertical indent. |

## `source_cleanup_strategy`

This is the most important rendering behavior switch.

- `typst_fill`
  Keep original PDF Text layer, do not run. bbox text strip. Each translatable text block is Typst Generate translation blocks with background color to cover the original text.
- `pikepdf_text_strip`
Set default policy. Render pre. pikepdf deletes original PDF content stream Text display operations by bbox; encountered `formula` / `display_formula` bbox Protected areas only. Preserve formula text. No page skip for display formulas.overlay stage based on `source_text_precleaned_page_indices` Skip old in-page. PyMuPDF redaction/visual cover, with visual coverage still handled by Typst Text block background.
- `bbox_text_strip`
  Compatibility alias; current behavior unchanged. `pikepdf_text_strip`Reserved for old configurations and historical tasks.
- `redact_restore_formulas`
  Legacy name compatibility. Behavior unchanged. `pikepdf_text_strip`Name retained for historical tasks and legacy. spec Playback supported; do not extend it per "delete then paste back formula" semantics.
- `legacy`
  Legacy policy alias; current behavior identical. `pikepdf_text_strip`。

used by default `pikepdf_text_strip` reason:

- Minimize original text leaking from Typst Probability of background block edge bleed.
- pikepdf path changes. text-op Delete older than PyMuPDF redaction more suitable for formal PDF Provide source text for translation.
- `formula` / `display_formula` bbox Reserved as protected area. Visual masking still by... Typst Background block fallback.
- If a certain category PDF Deletion is riskier; set explicitly. `typst_fill` Overwrite only.

## Stage Spec Mapping

Rust-written stage spec Must include these fields:

- `provider.spec.json.render.source_cleanup_strategy`
- `book.spec.json.render.source_cleanup_strategy`
- `render.spec.json.params.source_cleanup_strategy`
- `translate.spec.json.params.render_prewarm_source_cleanup_strategy`

Translation phase warm-up rendering source Must match the final rendered output. `source_cleanup_strategy`otherwise preheat manifest will be due to fingerprint Inconsistency causes failure.

## Job Snapshot

Each job On creation,Rust API Will. resolved render Write Parameters:

```text
DATA_ROOT/jobs/<job_id>/artifacts/render_config.json
```

Authoritative rendering configuration snapshot for debugging a historical task.artifact key as `render_config_json`。
Python's `pipeline_summary.json` May supplement run results and diagnostics, but not replace this. Rust Side config snapshot.

## Modify rules

Add or edit render When parameters, must complete simultaneously:

1. Update Rust `RenderInput` Default.
2. Update Rust validation.
3. Update stage spec Write and Python loader.
4. Update `API_SPEC.md` and this document.
5. Add at least one. Rust validation Test or stage spec test.

Don't allow Python Silently accept unknown values and fall back to defaults. Unknown values should Rust API Layer returns directly `400`so frontend issues are exposed as early as possible.
