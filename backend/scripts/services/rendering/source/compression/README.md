# rendering/source/compression

## Responsibilities

PDF Compression layer. Handles image compression.Ghostscript Compress and analyze before compressing.

## Public entry point

- `image_pipeline.py`
- `ghostscript.py`
- `analysis.py`

## What not to do

- Do not change page content.
- Do not do redaction.
- Do not participate in OCR/translation/layout decisions.
