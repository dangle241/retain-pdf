# rendering/layout

## Responsibilities

Layout layer. Here, the translated payload Convert to renderable block, calculate font, line spacing.bbox Adaptive and body block layout.

## Public entry point

- `page_specs.py`
- `font_fit.py`
- `chinese_body_fit.py`
- `fit_decision/`
- `title_fit.py`
- `payload/`
- `typography/`
- `typography_memory/`
  Cross-book font/Line spacing experience library. Cache only those corresponding to quantized geometric features. `font_size_pt`、`leading_em` Statistic value for rendering. seed Fast prior.

## What not to do

- Do not manipulate PDF original page.
- Do not delete original English text.
- No call. OCR provider or translation models.
- No page decision. redaction/background Route.

## typography memory

`typography_memory/` A global, incrementally-learned typesetting scalar library, stored by default in `data/_render_typography_memory/typography_memory.sqlite3`。

Boundaries:

- Allow only scalar decisions like font size and line spacing.
- key Only by quantized bboxPage dimensions, roles, line counts, formula ratios, translation density structure generated.
- Do not cache original text, translation, formulas, colors, deletion policy, page spec, or PDF objects.
- Hit conditions conservative. Insufficient samples or excessive variance: fall back original algorithm.

Switch:

- `RETAIN_RENDER_TYPOGRAPHY_MEMORY=0` Read/write can be closed.
- `RETAIN_RENDER_TYPOGRAPHY_MEMORY_MIN_OBS` Adjustable minimum sample count for hit.
