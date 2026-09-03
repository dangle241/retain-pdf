# Python Pipeline Contribution Guide

## Layering direction

Overall layering:

```text
entrypoints -> runtime/pipeline -> services/* -> foundation
```

Basic rules:

- OCR provider raw payloads must enter `document_schema` first, producing `document.v1`.
- The main chain only consumes `document.v1` and the translation stage spec.
- The main rendering chain only consumes the source PDF, the translation manifest, the page payload, and the render stage spec.
- `runtime/pipeline` is stage orchestration only. It must not absorb OCR provider, LLM, Typst, or redaction details.
- Translation does not import `services.rendering`, and does not consume OCR provider raw JSON.
- `ocr_provider` does not import `services.translation` or `services.rendering`.

See more detailed rules in the Python backend architecture boundaries document.

## Change rules

- Place new logic inside the existing layered directories. Avoid cross-layer imports.
- Translation, rendering, and OCR provider boundaries are enforced by `doc/core/python/architecture.md`.
- When adding new rule logic, prioritize adding minimal regression tests, especially for formula and terminology handling, bbox computation, and payload transforms.
- Translation consistency, glossary, formula protection, and rendering strategy should be kept as stable as possible. Pass data through `manifest` / `spec`; do not read internal temporary files across modules.
- For rendering and PDF changes, document the expected change in PDF content, file size, first-screen preview experience, or copyable text.

## Common checks

Run the relevant checks before submitting a Python pipeline change. For translation:

```bash
python3 -m compileall -q backend/scripts/services/translation
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/translation -q
python3 backend/scripts/devtools/check_pipeline_architecture.py
```

For document schema / OCR provider:

```bash
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/document_schema -q
python3 backend/scripts/devtools/check_pipeline_architecture.py
```

For rendering:

```bash
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/rendering -q
python3 backend/scripts/devtools/check_pipeline_architecture.py
```

## PR description

PRs involving the Python pipeline should at minimum state:

- Which segment of OCR, translation, or rendering is impacted.
- Whether the change affects `document.v1`, the translation manifest, the render payload, or phase events.
- Whether it affects legacy job re-rendering, breakpoint recovery, or diagnostics.
- Which samples were used for verification, and whether they cover formulas, figure captions, footnotes, long paragraphs, or high-page-count PDFs.
