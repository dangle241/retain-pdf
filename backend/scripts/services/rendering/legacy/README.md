# rendering/legacy

## Responsibilities

Legacy caller compatibility entry for the rendering layer. Preserves history. API Shape, but new features should not continue to be written here.

## Public entry point

- `pdf_overlay.py`
- `typst_page_renderer.py`
- `background_image_route.py`
- `pdf_compress.py`
- `render_payloads.py`

## What not to do

- No new business logic.
- Not implement directly. redaction、layout、Typst Compilation details.
- Bypass not allowed. `workflow/` Assemble a new main rendering pipeline.

## Naming conventions

New code should prefer importing implementation directory, e.g.:

- `services.rendering.output.typst.*`
- `services.rendering.source.cleanup.*`
- `services.rendering.source.background.*`
- `services.rendering.source.compression.*`

Add here only when compatibility with legacy callers is required. wrapper。
