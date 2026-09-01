# Translation layer description

This document records the current Python Stable boundaries of translation layer, directory responsibilities, troubleshooting entry. Describes mainline contract; temporary migration process not recorded.

## Location and Responsibilities

The translation layer is at:

```text
backend/scripts/services/translation/
```

It only handles standardization. OCR Documents become renderable translation artifacts.

```text
document.v1.json
-> per-page translation payload
-> translation-manifest.json
-> translation diagnostics/debug index
```

Translation layer not responsible for:

- Calling the OCR provider, downloading the provider zip, or parsing provider raw JSON.
- Edit Source PDFErase English. Generate English. Typst overlay Or write final PDF。
- Directly handling HTTP requests and the job state machine from the Rust API.

Stable upstream input is `ocr/normalized/document.v1.json`Stable downstream output is critical. `translated/translation-manifest.json` Add per page payload JSON。

## Main entry

External and stage worker Do not translate internal modules directly. Use these entry points first:

- `backend/scripts/services/translation/translate_only_pipeline.py`
  `translate.stage.v1` workerRequirements [action] [clarify] User must state goal not solution. `--spec <job_root>/specs/translate.spec.json`。
- `backend/scripts/services/translation/from_ocr_pipeline.py`
  provider/normalize One of the entry points for subsequent translation and rendering.
- `backend/scripts/services/translation/workflow`
  Translation Layer Internals facade，`runtime/pipeline/translation_stage.py` Enter translation execution here.

In the current stage spec, start_page / end_page are 0‑based page numbers; end_page=0 indicates processing only the first page and must not be interpreted as an unset value.

## Directory hierarchy

Current top-level directories split by responsibility:

| Directory | Responsibilities |
| --- | --- |
| workflow/ | Translation workflow orchestration: load input, generate execution plan, run continuation/policy/batch, write manifest and summary. |
| `ocr/` | Read-only `document.v1.json`, extract translatable blockproject to translation payload item。 |
| `payload/` | payload Protocol, template, formula protection, result backfill.manifest Write out. |
| `policy/` | whether to translate, technical blocks hintText filtering. Pattern configuration. |
| `context/` | Context translation. Nearby window model. Execution context model. |
| continuation/ | Same‑page/cross‑page consecutive paragraph candidates, rules, and review. |
| `orchestration/` | translation unit、layout zoneDocument-level orchestration metadata. |
| `batching/` | pending item Collect, deduplicate, fast path, batch partition, concurrent queue entry. |
| `results/` | Apply translation result, repeat item Expand,job memory Update, periodic flush to disk. |
| `llm/` | provider runtime、prompt Protocol, caching, response parsing, retries, validation. |
| `memory/` | job Level Terminology/Abbreviation/Stabilize TM candidate selection, filtering, summarization, and persistence. |
| `terms/` | Glossary normalization, prompt injection, and term hit statistics. |
| `diagnostics/` | Diagnosisdebug index、item Level positioning information. |
| `classification/` | `precise` Suspicious block classification by mode. |
| `fast_path/` | Explicitly no model translation needed. keep-origin Fast path. |
| `postprocess/` | After translation, light fixes, e.g. garbled candidate recovery. |

The compatibility shim backend/scripts/runtime/pipeline/book_translation_*.py has been deleted. New code must not depend on runtime.pipeline.book_translation_*.

## Data contract

### Input

Translation layer consumes only by default. `document.v1` Formal fields:

- `geometry`
- `content`
- `layout_role`
- `semantic_role`
- `structure_role`
- `policy`
- `provenance`

Body whitelist:

```text
content.kind == "text"
policy.translate == true
```

Whether to enter translation should be explicitly determined at the normalize/adapter phase. The translation layer no longer re‑guesses main text from provider raw fields, old sub_type, or metadata.

### Output

The translation output is fixed as:

```text
translated/
  translation-manifest.json
  page-0001.json
  page-0002.json
  ...
artifacts/
  translation_diagnostics.json
  translation_debug_index.json
```

Per‑page payload places formal fields at the top level, e.g.:

- `block_kind`
- `layout_role`
- `semantic_role`
- `structure_role`
- `policy_translate`
- `asset_id`
- `reading_order`
- `raw_block_type`
- `normalized_sub_type`

`metadata` Debug only.provider trace and minor bridging information; not a formal semantic entry point for new logic.

## Execution flow

Main flow simplified:

```text
load document.v1
-> extract text items
-> ensure page payload templates
-> initial continuation pass
-> optional continuation review
-> page policy/classification
-> finalize orchestration metadata
-> annotate context windows
-> collect pending translation units
-> dedupe / fast path / queue split
-> LLM translate with cache/retry/validation
-> apply results and flush pages
-> garbled reconstruction
-> write manifest, diagnostics, debug index
```

Batch execution here has been extracted from the old runtime pipeline:

- `batching/` determine which item Which queues to enter?
- `workflow/batch_runner.py` Execute serially or in parallel. batch。
- `results/` Responsible for backfill and disk flush.

## Credentials and page range

API keys are not written into the stage spec. The spec only saves:

```json
"credential_ref": "env:RETAIN_TRANSLATION_API_KEY"
```

Real values injected by environment variables at runtime. key。

Page range field 0 Closed interval:

- `start_page=0, end_page=0`Only process the first page.
- `start_page=0, end_page=-1`Process from first page to last page.

stage spec loader must keep legal `0`, cannot use `value or default` Parse page number.

## Debug Entry

Troubleshoot a certain job For translation issues, prioritize:

```text
data/jobs/<job_id>/translated/translation-manifest.json
data/jobs/<job_id>/artifacts/translation_diagnostics.json
data/jobs/<job_id>/artifacts/translation_debug_index.json
data/jobs/<job_id>/logs/pipeline_events.jsonl
```

Determine a item Why an item was not translated, downgraded, or kept as original:

1. Find the item in translation_debug_index.json.
2. Look at route_path, output_mode_path, error_trace, and fallback_to in translation_diagnostics.
3. To reproduce, use existing. replay/debug Tools only. No manual edits. payload。

## Verify command

After translation layer changes, at least run:

```bash
python3 -m compileall -q backend/scripts/services/translation
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/translation -q
python3 backend/scripts/devtools/check_pipeline_architecture.py
```

If you change the stage spec page range or provider‑backed workflow, also run:

```bash
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/document_schema/test_normalize_stage_spec.py -q
python3 backend/scripts/devtools/check_stage_specs_contract.py data/jobs
```

## Boundary rules

Translation layer: no reverse dependencies.

- `services.rendering`
- Provider private raw structure
- `runtime.pipeline.book_translation_*`

New code should first be placed into existing layered directories. Architecture boundaries:

```text
backend/scripts/devtools/check_pipeline_architecture.py
```

As the source of truth.
