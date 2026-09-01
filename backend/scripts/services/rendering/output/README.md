# rendering/output

## Responsibilities

Final output generation layer. Houses output writing beyond Typst, overlay composition, and PDF write helpers.

## Public entry point

- `pdf_writer.py`
- Subsequently, typst/ will gradually migrate here.

## What not to do

- Do not make OCR/translation judgments.
- Do not make page redaction strategy.
- Do not do bbox font adaptation.
