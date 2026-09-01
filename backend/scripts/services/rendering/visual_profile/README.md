# Render visual profile

`visual_profile` A generic pre-render visual sampling layer. Responsibility: extract each from page pixels. OCR item background color and foreground text color.

Does not check. PDF Editable does not determine physical deletion. Rendering strategy consumes only stable contract it outputs:

- `background_rgb`Local background color for overwriting original text.
- `text_rgb`：Typst Text color change. Use CSS. Inline style. `color: #000;` → skipped: external stylesheet, add when multiple elements require styling.
- `confidence`Current color confidence.
- method: sampling source, e.g., background_pixels+span_color or background_pixels+foreground_pixels.
- `warnings`Unable to identify diagnostic information such as foreground.

Design boundaries:

- Visual layer always operational; applies to editable PDF, pseudo-editable PDF, and image PDF.
- The deletion layer is an optimization; on failure, visual fallback must guarantee the final result.
- This package only generates profiles; it does not modify them. PDFdo not write rendering strategy.

During warm-up, the full profile is written to disk. `render_prewarm/visual_profile.v1.json`Preheat oven. manifest Save only relative paths and lightweight. `colors_by_item_id`color pick, delete,Typst Render reads same local copy at different times. JSONrather than relying on temporary objects in memory.
