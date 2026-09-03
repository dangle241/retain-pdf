# rendering/analysis/profile

## Responsibilities

Single-page fact portrait layer. Facts only: page dimensions, text layers, background images, vector objects, and OCR bbox Summary.

Pseudo-editable PDFImage type PDFMerge complex mixed pages vector re-pages here first.
`RenderPageProfile.kind`The execution layer must not recombine "background images + Text Layer + Vector object
such judgments, otherwise the follow-up source cleanup、hidden text strip、overlay route Will fork again.

## Public entry point

- `builder.py`
- `models.py`
- `registry.py`

## What not to do

- Do not decide redaction strategy.
- Do not manipulate PDF page content.
- Do not generate Typst or layout blocks.
- Keep classification consistent across all call sites.

When adding a new profile dimension, prioritize adding an independent one. `.py` file, and then by `builder.py` Summary.
