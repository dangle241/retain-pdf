# 0002 Use Typst as translation text overlay rendering engine

## Background

RetainPDF needs to be on the original PDF overlay translated text while preserving formulas, images, tables, and page visual structure. Pure PyMuPDF Limited writing ability, complex. markdownFormula and automation fit insufficient expressive power.

## Decision

Use primary rendering path: Typst generates overlay, then compose with cleaned PDF background.

PyMuPDF Continues to be responsible for:

- Read and Save PDF。
- Copy bookmarks.
- Page redaction / Background cleanup.
- Final PDF merge and compression.

Typst is responsible for:

- Translation text layout.
- markdown / Formula rendering.
- overlay Page Compilation.

## Consequences

- Rendering layer must be maintained. `layout -> RenderBlock -> Typst source -> overlay PDF` Clear link.
- Typst Layers should not interpret directly. OCR provider or translation strategies.
- Redaction and layout errors reflect to Typst overlay visual results, but responsibilities must not be mixed.

## Alternatives

- Use only PyMuPDF to write text directly. Simple implementation, but complex formulas and markdown fit insufficiently.
- convert the original PDF Convert full page to image then overlay text. Visually stable, but output size increases significantly, and loses selectable text, bookmarks, etc. PDF Structure.
