# rendering/output/typst

## Responsibilities

Typst output implementation layer. Responsible for generating Typst source, invoking Typst compilation, and handling Typst/PDF helpers for overlay composition.

## Public entry point

- `book_renderer.py`
- `book_support.py`
- `compiler.py`
- `source_builder.py`
- `overlay_ops.py`
- `source_page_overlay.py`

## What not to do

- Do not execute OCR or translation.
- Do not make original PDF cleanup strategy.
- Do not calculate bbox font adaptation for translation.
