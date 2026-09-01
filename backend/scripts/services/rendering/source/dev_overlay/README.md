# rendering/source/dev_overlay

Old PyMuPDF direct-draw translation path, only for direct overlay page single debug PDF and backward compatibility
services.rendering.legacy.pdf_overlay call.

Not the main render path. New book/official page rendering logic should use Typst overlay and
`source.redaction` / `source.render_source`Do not continue expanding the body layout rules here.

## Boundaries

- May call source layer primitives/facades, e.g., source.redaction, source.items,
  `source.background.fill`。
- Do not directly depend on source.cleanup.redaction; use source layer facade when original text cleanup is needed.
- Don't add. Typst generation,OCR provider Parse or translate strategy logic.
