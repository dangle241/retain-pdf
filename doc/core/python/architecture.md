# Python Backend architecture boundaries

This document describes `backend/scripts` Long-term maintenance boundaries. Goal is not reduce file count, but ensure code remains locatable, testable, and modifiable after growth.

## Overall layering

```text
entrypoints
  -> runtime/pipeline
    -> services/*
      -> foundation
```

Responsibilities:

- `entrypoints/`
  Command-line entry point: only parses arguments and invokes the stable service entry.
- `runtime/pipeline/`
  Stage orchestration layer, responsible for OCRTranslation order, rendering order, stages specEvent handoff.
- `services/`
  Capability layer: includes OCR provider、document schema、translation、rendering Await business capability.
- `foundation/`
  Configuration, shared foundational tools, and cross-service underlying capabilities.

## Stable subsystem

```text
services/document_schema
services/ocr_provider
services/mineru
services/translation
services/rendering
services/pipeline_shared
runtime/pipeline
```

Core Rules:

- OCR provider raw payload must first enter document_schema to produce document.v1.
- The translation main chain only consumes document.v1 and the translation stage spec.
- The rendering main chain only consumes the source PDF, translation manifest, per‑page translation payload, and the render stage spec.
- runtime/pipeline is only responsible for orchestration and does not absorb details of providers, LLMs, Typst, or redaction.

## Rendering layer boundary

```text
services/rendering/workflow
  -> document / analysis
  -> source
  -> layout
  -> output
```

Responsibilities:

- `workflow/`
  Serial rendering mode select overlay、dual、background typst Wait for path.
- `analysis/`
  Page profiling, classification, and rendering route decision.
- `document/`
  Page mapping, table of contents/Copy bookmarks and document-level assistance.
- `source/background/`
Generate a cleaned background PDF.
- `source/cleanup/`
Directly manipulate PDF pages; responsible for deleting or overwriting the original text area.
- `layout/`
Convert translated items into RenderBlock / page specs.
- `output/typst/`
Generate Typst source, compile an overlay PDF, and execute the overlay merge.
- `source/compression/`
  PDF Compression.
- `layout/model/`
  Render public data model.

Prohibited directions:

- output/typst must not import source/cleanup.
- layout must not import output/typst, source/cleanup, or source/prepare.
- source/cleanup must not import output/typst or high‑level layout logic.
- `runtime/pipeline` Not direct. import `services.rendering.output.typst`、`services.rendering.source.cleanup`、`services.rendering.layout`。

## Layer boundary

```text
services/translation/workflow
  -> context
  -> policy
  -> memory
  -> llm
  -> payload
```

Responsibilities:

- `workflow/`
  Translation request entry and execution facade.
- `context/`
  domain guidance、memory guidance Combine.
- `policy/`
  whether to translate, how to handle layout preservation, and other strategies.
- `memory/`
  job level terms and layout‑preservation memory.
- `llm/`
  provider Call, retry, checksum. fallback。
- `payload/`
  Translation output agreement.

Prohibited directions:

- runtime/pipeline/translation_stage.py must not directly import internal details of policy, llm, or diagnostics.
- translation must not import services.rendering.
- translation must not consume provider raw JSON.

## OCR boundary

```text
ocr_provider / mineru
  -> document_schema
  -> document.v1
```

Prohibited directions:

- ocr_provider must not import services.translation.
- ocr_provider must not import services.rendering.
- translation and rendering must not import services.ocr_provider or services.mineru.

## Public entry

Top-level only calls these entry points:

- `services.ocr_provider.provider_pipeline`
- `services.document_schema.normalize_pipeline`
- `services.translation.workflow`
- `services.rendering.workflow.execute_render_plan`
- `runtime.pipeline.book_pipeline`

If adding a new entry, must also update:

- This document.
- Corresponding directory README。
- `backend/scripts/devtools/check_pipeline_architecture.py`。

## When to continue splitting files

Split if any condition below:

- File exceeds size limit. Split or compress. 300 line and contains 3 Multiple responsibilities.
- Changing a small feature requires cross- 5 Directories above one.
- Circular dependency detected.
- Same logic repeated in multiple modules.
- Tests are hard to write because IOStrategy data structure mixed in function. Refactor: separate into dedicated modules.

When conditions not met, add tests first, then docs, then arch checks. Do not split files.
