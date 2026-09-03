Pipeline directory description

`scripts/runtime/pipeline/` orchestrates OCR standardized artifacts, translation pipeline, and rendering pipeline into a stable bus.

This does not contain specifics. OCR provider Parsing, translation model invocation, or PDF Not low-level rendering details, but rather responsible for "how to organize these capabilities in the correct order".

## Phase Contract

### 1. OCR / Normalize Phase

Responsibility boundaries:

Input: provider raw OCR result, source PDF, and provider metadata.
Unified output middleware: `document.v1.json` and `document.v1.report.json`.
Stop here; no longer responsible for translation and final PDF rendering.

Stable handoff point:

- translation / rendering Main branch only should handle `document.v1.json` As OCR Formal input after stage completion.
- provider raw JSON、zip、unpacked Directory reserved for adapterDebug traceback

Translation stage

Responsibility boundaries:

Input: `document.v1.json`, translation strategy parameters, translation output directory.
- output page-by-page translation payload、`translation-manifest.json`translation summary and diagnostic information
- Up to this point, not responsible for provider raw Parse only; source not handled. PDF Write-back and final PDF Deliver

Stable handoff point:

Rendering stage shall consume only translation output protocol; do not reverse-read provider raw OCR structure.
- Current default translation output protocol: per page. translation payload plus `translation-manifest.json` Composition
Render-only main branch now requires manifest only; no fallback to old page-by-page JSON scan.
- translation Stage allows source read. PDF Domain inference or policy assistance; does not own source. PDF Rendering control
- If glossary is enabled,translation The stage also writes the glossary summary. `translation-manifest.json`Diagnostic files generate. pipeline summaryThese fields are metadata; they do not alter the rendering input protocol.
Pipeline summary and translation manifest still write `invocation` field declaring current stage schema version.
- Stages worker Still present. `logs/pipeline_events.jsonl` Add unified stage events; this document is a follow-up. Rust API Interim landing point for event protocol closure

Rendering stage

Responsibility boundaries:

- Input Source PDFTranslation product render parameters
- output final PDFand necessary intermediate overlay / typst / Compressed artifacts
Stop here; not responsible for OCR provider recognition, does not initiate translation model requests.

Stable handoff point:

- rendering Main branch only accept "source" branch PRs. PDF + These inputs
OCR structural issues: investigate `document.v1.json` / `document.v1.report.json`, do not patch with provider-specific logic in render layer.

## Module division of labor

- `book_pipeline.py`
  Unified orchestration entry. Maintain the most stable external invocation surface. Chains translation and rendering phases, returns aggregated result of the whole flow.
- `translation_stage.py`
  Handles translation stage only. Input `document.v1.json` Set output directory. Crop page range. Assemble academic mode strategy. Translate full book. Output page by page. translation payload。
- `render_stage.py`
  Rendering phase only. Input source. PDF and translation output, according to `overlay`、`typst`、`dual` Wait for final pattern generation. PDF。
- `services/pipeline_shared/`
  Not part of. `runtime/pipeline/`but it carries cross-stage shared stdout contract、summaryUnify `pipeline_events.jsonl` Event streams and JSON IO；pipeline Depend on this layer, not on some prior one. provider Module Sharing helper。
- `render_inputs.py`
  Only responsible for validating Render-only Call protocol, put `source_pdf_path + translations_dir/translation_manifest_path` Normalize to stable, consumable input for the rendering phase.
- `render_mode.py`
Only responsible for page range and `auto` mode determination, including editable PDF path selection.
- `translation_loader.py`
  Only responsible for reading and filtering translation result files per-page translation JSON Organize into render-stage consumable data structure.
- `translation_stage.py`
Responsible for full-book translation phase pipeline facade; internally invokes `services.translation.workflow` for continuation, strategy, batch translate, result backfill, persist.

## Collaboration

Standard procedure:

`OCR JSON -> translation_stage -> translation JSON -> translation_loader/render_stage -> final PDF`

Here `OCR JSON` defaults to `document.v1.json`.

Rust API complete provider-backed workflow also chained by this boundary:

- OCR Generate subtasks first. `document.v1.json`
Translate-only entry generates page-by-page translation payload and `translation-manifest.json`.
- render-only Re-consumption source entry PDF and translation artifacts to generate the final PDF

Supplementary conventions:

- If the entry point receives raw provider JSONshould first pipeline External or translation Explicitly normalize at entry.
Pipeline does not understand provider private raw structure.
If only viewing provider detection, default completion, or schema validation summary, read `document.v1.report.json` first.
- The complete task can be chained in three stages, but the input of the three stages/Output boundaries must remain independent; do not rely on private memory objects for implicit coupling.
If re-rendering only, reuse existing job's `source_pdf` and `translations_dir`; do not re-enter OCR or translation phase.

## Stable external entry point

Recommended: use the following entry points first.

- `run_book_pipeline(...)`
- `translate_book_pipeline(...)`
- `build_book_pipeline(...)`
- `build_book_from_translations(...)`
- `run_render_stage(...)`
- `resolve_page_range(...)`
- `is_editable_pdf(...)`

Supplementary conventions:

- Stage entry fixed to `--spec <stage-spec.json>` Protocol
- normalize Phase Mapping `normalize.stage.v1`
Translate-only stage corresponds to `translate.stage.v1`.
Render-only stage corresponds to `render.stage.v1`.
- provider-backed Current full-process mapping `provider.stage.v1`
  This is an implementation detail, not an upper-layer workflow naming requirement
- Based on normalization. OCR Entire chain entry mapping `book.stage.v1`
Rust main workflow worker entry now requires `--spec`.
Local development entry also unified to use stage spec driving.

## Call Suggestions

- CLI、APIIntegration layer first only depend `book_pipeline.py`
- OCR Enter after stage completion. `runtime/pipeline/`; do not provider raw Place processing logic back here.
- Call when translating only `translate_book_pipeline(...)`
Call only during rendering: `build_book_pipeline(...)` or `run_render_stage(...)`.
  Must be provided when calling. `source_pdf_path`, and one of the following two translation inputs:
  - `translations_dir`
  - `translation_manifest_path`
- If neither provided, or absent from directory. `translation-manifest.json`The entry directly throws a fixed `Render-only input error`
- Rendering phase no longer automatically guesses old task directory or old page file naming.
- Do not manually assemble page ranges, mode detection, or translation directory reads at upper layers.

## Decoupling Regression

Current dedicated regression coverage:

- Python：manifest-only Loading translation outputRender-only Input Protocol
- Rust：OCR-only job snapshot、Translate workflow、Render workflowComplete task entryartifact manifest Discover

Common check commands:

```bash
PYTHONPATH=backend/scripts python -m pytest backend/scripts/devtools/tests -q
cd backend/rust_api && cargo test -q
```

## Collaboration rules

`runtime/pipeline/` Maintainable solely by orchestration lead; responsibilities must remain within stage organization.

- Handles only phase order, entry protocol, task directory, and cross-phase result aggregation.
Do not embed provider private adaptation logic into pipeline.
- Do not leak translation strategy details or rendering implementation details back into pipeline
- If modifying stage input/output contract, must synchronously update upstream modules. READMEDownstream module README、CLI/API Entry and Regression Testing
- Module-internal only. bugprioritize fixing within the module;pipeline Keep only necessary orchestration adaptation layers.
