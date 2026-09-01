# display_stage and lane

## display_stage

`display_stage` Stable major phase of the front-end presentation layer.

Allowed values:

- `ocr`
- `translation`
- `render`
- `done`

It and the backend internals. `stage` Frontend main state not use internal directly. `stage`。

## stage

`stage` Backend internal phase name, e.g.:

- `ocr_processing`
- `translating`
- `rendering`
- `saving`
- `failed`

Used for diagnosis and log classification; not guaranteed suitable for direct use as UI Major Phase.

## substage

`substage` Machine-readable substage, e.g.:

- `ocr_upload`
- `ocr_processing`
- `translation_batches`
- `continuation_review`
- `page_policies`
- `domain_inference`
- `garbled_repair`
- `render_prepare`
- `render_prewarm`
- `render_pages`
- `render_compile`

## lane

`lane` Resolves display issue where translation and rendering preprocessing run simultaneously.

- `main`: Current task main line.
- `background`: Backend auxiliary phase.

Example:

```json
{
  "display_stage": "translation",
  "stage": "translating",
  "substage": "translation_batches",
  "lane": "main"
}
```

```json
{
  "display_stage": "render",
  "stage": "rendering",
  "substage": "render_prewarm",
  "lane": "background"
}
```

Frontend should treat the first as primary status and the second as background ready status.
