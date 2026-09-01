# Python Pipeline Contribution Guide

## Layering direction

Overall layering:

```text
entrypoints -> runtime/pipeline -> services/* -> foundation
```

Basic rules:

- OCR provider raw payload must enter document_schema first, producing document.v1.
- Main chain only consumes document.v1 and translation stage spec.
- Main rendering chain only consumes source PDF, translation manifest, page payload, and render stage spec.
- `runtime/pipeline` Orchestration only, no absorption. provider、LLM、Typst、redaction Details.
- translation does not import services.rendering, nor consumes provider raw JSON.
- ocr_provider does not import services.translation or services.rendering.

See more detailed rules in Python backend architecture boundaries.

## Change rules

- Place new logic in existing layered directories. Avoid cross-layer. import。
- Translation, rendering, OCR provider boundaries are enforced by doc/core/python/architecture.md.
- Prioritize adding minimal regression tests when adding new rule logic, especially for formulas and terminology.bbox、payload Transform.
- Translation consistency, glossary, formula protection, and rendering strategy should be as stable as possible. manifest/spec Pass data; do not read internal temporary files across modules.
- Rendering and PDF Ghi rõ thay đổi output khi dịch. Gửi văn bản cần dịch. PDF Content, size, first-screen preview experience, or copyable text.

## Common checks

Python Please provide the source text to translate.

```bash
python3 -m compileall -q backend/scripts/services/translation
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/translation -q
python3 backend/scripts/devtools/check_pipeline_architecture.py
```

Python document schema / provider Related:

```bash
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/document_schema -q
python3 backend/scripts/devtools/check_pipeline_architecture.py
```

Rendering:

```bash
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/rendering -q
python3 backend/scripts/devtools/check_pipeline_architecture.py
```

## PR description

PRs involving Python pipeline should at least state:

- Impact OCR、translation、rendering which segment.
- Whether it changes document.v1, translation manifest, render payload, or phase events.
- Does it affect the old? job re-rendering, breakpoint recovery, or diagnostics.
- Which samples were used for verification? Do they include formulas, figure captions, footnotes, long paragraphs, or high-page-count PDFs? PDF。
