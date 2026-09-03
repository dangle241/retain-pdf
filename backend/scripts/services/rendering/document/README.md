# rendering/document

## Responsibilities

Rendering phase PDF Document-level assistance capabilities, including source PDF Preparation, Page Number Mapping, and Table of Contents/Copy Bookmark

## Public entry point

- `source_pdf.py`
- `page_map.py`
- `metadata.py`

## What not to do

- Skip page generation. Use CLI/API only. redaction。
- Do not generate Typst.
- Do not make OCR/translation judgments.
