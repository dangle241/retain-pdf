# Python Pipeline Directory Map

This document answers only one question:

**Now that you need to modify `backend/scripts`, which directory should you enter first.**

## Most common entry points

- Switch to manual execution entry.
  [`entrypoints/`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints)
- Modify stage orchestration bus:
  [`runtime/pipeline/`](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline)
- Modify OCR provider access:
  [`services/ocr_provider/`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider)
- Change unified OCR contract:
  [`services/document_schema/`](/home/wxyhgk/tmp/Code/backend/scripts/services/document_schema)
- Change the translation main chain:
  [`services/translation/`](/home/wxyhgk/tmp/Code/backend/scripts/services/translation)
- Change main render chain:
  [`services/rendering/`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering)

## Instant main chain overview

### provider-backed Full process

```text
entrypoints/run_provider_case.py
  -> services/ocr_provider/provider_pipeline.py
-> services/mineru/* or services/ocr_provider/paddle_api.py
     -> services/document_schema/*
     -> runtime/pipeline/book_pipeline.py
        -> runtime/pipeline/translation_stage.py
           -> services/translation/*
        -> runtime/pipeline/render_stage.py
           -> services/rendering/*
```

### normalized OCR -> translate -> render

```text
entrypoints/run_book.py
  -> services/translation/from_ocr_pipeline.py
     -> runtime/pipeline/book_pipeline.py
        -> translation_stage.py
        -> render_stage.py
```

### translate-only

```text
entrypoints/run_translate_only.py
  -> services/translation/translate_only_pipeline.py
     -> runtime/pipeline/translation_stage.py
        -> services/translation/*
```

### render-only

```text
entrypoints/run_render_only.py
  -> services/rendering/workflow/render_only.py
     -> runtime/pipeline/render_stage.py
        -> services/rendering/*
```

## Top-level Directory Map

### `entrypoints/`

- Purpose:
  Outermost entry: parameter receive, exception wrap, route to stable entry.
- Should not do:
Do not assemble provider Process yourself, not directly touching translation./Deep rendering implementation.
- Typical files:
  - [`run_provider_case.py`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints/run_provider_case.py)
    provider-backed full flow Main Entry.
  - [`run_book.py`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints/run_book.py)
Normalized OCR -> translate -> render main entry.
  - [`run_translate_only.py`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints/run_translate_only.py)
    Please provide the source text for translation.
  - [`run_render_only.py`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints/run_render_only.py)
    Pure rendering entry point.

### `runtime/pipeline/`

- Purpose:
  Stage orchestration bus. Only responsible for sequencing, stage input/output, and result aggregation.
- Should not do:
  Understand nothing. Specify source text. provider raw JSON, does not absorb translation strategy details, does not implement PDF Low-level rendering.
- Key files:
  - [`book_pipeline.py`](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline/book_pipeline.py)
    Top-level `translate -> render` Orchestration.
  - [`translation_stage.py`](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline/translation_stage.py)
    Pure translation stage entry.
  - [`render_stage.py`](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline/render_stage.py)
    Pure rendering phase entry.
  - [`translation_loader.py`](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline/translation_loader.py)
Read `translation-manifest.json` and page by page payload.
  - [`render_inputs.py`](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline/render_inputs.py)
    render-only Finalize input protocol.

### `services/document_schema/`

- Purpose:
  OCR Unify intermediate contract layer.
- Entry condition:
Modify raw OCR -> `document.v1.json` adaptation, field default values,schema validation enters here.
- Key files:
  - [`normalize_pipeline.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/document_schema/normalize_pipeline.py)
Normalize worker entry.
  - [`adapters.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/document_schema/adapters.py)
    raw provider -> normalized document Total Adapter Port.
  - [`reporting.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/document_schema/reporting.py)
Normalization summary/report read.

### `services/ocr_provider/`

- Purpose:
  provider-backed OCR Main Entry and provider Finalize protocol.
- Entry condition:
Modify provider dispatch, Paddle API call,provider-backed worker main thread enters here.
- Key files:
  - [`provider_pipeline.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/provider_pipeline.py)
Current provider-backed full flow stable entry, also a script./Test the compatibility surface of dependencies.
  - [`paddle_api.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/paddle_api.py)
Paddle async API access.
  - [`paddle_markdown.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/paddle_markdown.py)
    Paddle Markdown Image artifacts saved to disk.
  - [`paddle_normalize.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/paddle_normalize.py)
    Paddle normalized document Geometry correction and other pure implementations.

### `services/mineru/`

- Purpose:
  MinerU provider the specific implementation.
- Entry condition:
  Change only MinerU provider transportUnpack here during download and extraction.
- Note:
  Here is provider Implementation, not OCR bus, nor translation/Render main chain.

### `services/translation/`

Purpose:
Normalize `document.v1.json`.
Entry criteria:
Change translation strategy, LLM scheduling, continuation, payload persistence, diagnostics.
Key files:
  - [`from_ocr_pipeline.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/translation/from_ocr_pipeline.py)
Normalized OCR -> translate -> render worker packaging entry.
  - [`translate_only_pipeline.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/translation/translate_only_pipeline.py)
Translate-only worker packaging entry.
  - [`workflow/translation_workflow.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/translation/workflow/translation_workflow.py)
    Single-page translation workflow.
  - [`llm/README.md`](/home/wxyhgk/tmp/Code/backend/scripts/services/translation/llm/README.md)
    LLM Directory boundary description.

### `services/rendering/`

Purpose:
  Translation output and source PDF into final PDF。
Entry criteria:
Modify overlay, TypstBackground fix, compress, render-only entry.
Key files:
  - [`workflow/render_only.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/workflow/render_only.py)
Render-only worker packaging entry.
  - [`workflow/`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/workflow)
    Render pipeline orchestration entry point.
  - [`output/typst/`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/output/typst)
    Typst Output main chain.

### `services/pipeline_shared/`

Purpose:
  provider / translate / render Shared stdout contract、summary、events、JSON IO。
What not to do:
Do not place provider private logic, nor translation/rendering algorithm details.

### `foundation/`

Purpose:
  Configuration, pathstage specShared toolsprompt loader。
Entry criteria:
Modify cross-module shared config or stage spec protocol.

### `devtools/`

Purpose:
  Debug, regression, probe, experiment scripts.
What not to do:
  Cannot reverse become primary dependency.

## Quick check

- Entry parameter invalid. worker Does the startup method change?
Start with `entrypoints/`.
- Is this a stage order change or input/output protocol change?
Start with `runtime/pipeline/`.
Is this raw OCR adaptation or schema change?
Start with `services/document_schema/`.
Is this provider integration issue?
Start with `services/ocr_provider/` or `services/mineru/`.
- Translation incorrect?
Start with `services/translation/`.
Is this PDF rendering incorrect?
Start with `services/rendering/`.

## Three boundary red lines

`runtime/pipeline/` does not understand provider raw JSON nor directly import provider private implementation.
`services/translation/` and `services/rendering/` do not consume provider raw structure; consume only stable handoffs.
`entrypoints/` connect only to stable endpoints. Do not bypass `*_pipeline.py` or `runtime/pipeline/*` to connect to deep implementation.

Newcomer reading order

1. [`README.md`](/home/wxyhgk/tmp/Code/backend/scripts/README.md)
   First understand the overall directory structure and the official entry point.
2. [`PIPELINE_DIRECTORY_MAP.md`](/home/wxyhgk/tmp/Code/backend/scripts/PIPELINE_DIRECTORY_MAP.md)
   Now know where to change.
3. [`runtime/pipeline/README.md`](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline/README.md)
   Check stage boundaries.
4. [`services/README.md`](/home/wxyhgk/tmp/Code/backend/scripts/services/README.md)
See services overall division of labor.
Then enter by module: `translation/`, `rendering/`, `ocr_provider/` READMEs.
