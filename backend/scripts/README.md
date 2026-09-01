# Scripts Overview

`scripts/` is the complete set: PDF -> OCR -> translation -> layout-preserving rendering script project directory.

Top level now split into five layers by responsibility:

- `runtime/`
  Runtime orchestration layer. Put only pipeline。
- `services/`
  OCR、MinerUImplementation layer: rendering, translation, etc.
- `foundation/`
  Configurations, shared tools, and prompt resources.
- `entrypoints/`
  Manual execution entry.
- `devtools/`
  Experiments, migrations, examples, test probes, diagnostic scripts.

Within `services/`, now clearly divided into two categories:

- provider / translation / rendering These capability modules.
- `services/pipeline_shared/` Such cross-stage shared protocol modules

## Main path

Core process summary:

`PDF -> OCR provider -> document_schema -> services/translation -> services/rendering -> PDF`

More specifically:

1. `normalize.stage.v1`
OCR provider feeds raw results to `document_schema`, producing `ocr/normalized/document.v1.json` and `document.v1.report.json`.
2. `translate.stage.v1`
   Translation chain read-only. `document.v1.json`Extract body whitelist block, fill continuation / orchestration Metadata, output `translated/`
3. `render.stage.v1`
   Render chain reads translation output and source only. PDFOutput `rendered/*.pdf`
4. `book.stage.v1`
   Top-level book workflow: orchestration only. `normalize -> translate -> render`No longer let downstream guess directly. provider Original structure

The current formal block-level contract is:

- `geometry`
- `content`
- `layout_role`
- `semantic_role`
- `structure_role`
- `policy`
- `provenance`

Note:

- `type/sub_type/bbox/text/lines/segments` Retained as compatibility field.
- translation / rendering Main branch no longer based on legacy monorepo. raw OCR Field or `derived/sub_type` re-guess body text
- whether to enter translation, with `policy.translate` Main entry point only
- translation payload Official consumption metric fixed as. strict top-level contractNo longer dependent. `metadata` Image

## Recommended entry point

For daily use, prioritize these entry points:

- `scripts/entrypoints/run_book.py`
  Current topmost complete entry. Through `book.stage.v1` Chain together `normalize -> translate -> render`Suitable for manually running the entire main chain locally.
- `scripts/entrypoints/run_provider_case.py`
  Run with one local commandprovider -> normalize -> translate -> renderUniversal entry name. Underlying provider Distribution layer determines specifics. OCR Implementation: entry name not exposed. provider。
- `scripts/entrypoints/run_document_flow.py`
When you already have OCR JSON and PDF, prefer this neutral entry name to run the complete process.
- `scripts/entrypoints/run_normalize_ocr.py`
Top-level normalize worker. Converts raw OCR JSON to final `document.v1.json`.
- `scripts/entrypoints/run_provider_ocr.py`
Local OCR-only generic entry. Runs only provider -> unpack -> normalize.
- `scripts/entrypoints/run_translate_only.py`
Top-level translate worker; accepts only standardized `document.v1.json`.
- `scripts/entrypoints/run_render_only.py`
Top-level render worker. Produces PDF.
- `scripts/entrypoints/translate_book.py`
  Translate only, do not render.
- `scripts/entrypoints/build_book.py`
  Render only, do not re-translate.
- `scripts/entrypoints/build_page.py`
  Single-page rendering debug entry.
- `scripts/entrypoints/translate_page.py`
  Single-page translation debug entry.
- `scripts/entrypoints/validate_document_schema.py`
Contract debugging entry. Inspects `document.v1` or adapter behavior, not daily full-chain entry.
- `scripts/devtools/tests/document_schema/regression_check.py`
  Long-term regression tool, not main entry point.

Don't set test scripts as main entry. For full-chain validation, run first:

1. `run_book.py --spec <job_root>/specs/book.spec.json`
Or submit job via Rust API; Rust drives three workers via spec.

If modifying the translation pipeline, recommended reading order:

1. `services/translation/README.md`
2. `services/translation/llm/README.md`
Then enter as needed: `services/translation/llm/providers/` or `services/translation/llm/shared/orchestration/`.

New provider integration order

If adding new OCR provider, first follow this order, do not directly change translation/Rendering pipeline:

First read `scripts/services/ocr_provider/README.md` to define provider API boundaries, state, raw artifact responsibilities.
   First. provider API Clearly define layer boundaries, state, and raw artifact responsibilities.
Then read `scripts/services/document_schema/README.md` to know which fields go to `geometry/content/layout_role/semantic_role/structure_role/policy/provenance`.
   Explicit fields should go to. `geometry/content/layout_role/semantic_role/structure_role/policy/provenance` which layer.
3. Prepare minimum raw fixture
   Place `scripts/devtools/tests/document_schema/fixtures/`。
Implement new provider and adapter via `scripts/services/document_schema/adapters.py` to unify access to schema.
Through `scripts/services/document_schema/adapters.py` unify access to schema.
Register fixture to `scripts/devtools/tests/document_schema/fixtures/registry.py`; do not patch mainline for compatibility. Fork branch. Cherry-pick fixes only for provider raw JSON.
Do not patch mainline for compatibility. Fork branch. Cherry-pick fixes only for provider raw JSON.
6. run `scripts/devtools/tests/document_schema/regression_check.py`
   At least confirm detector、adapt、validation、extractor smoke All passed.

## Top-level directory description

- `services/mineru`
  MinerU Access, download, unpackjob Organize.
- `services/pipeline_shared`
Provider / translate / render shared stage protocol, summary, and JSON IO.
- `services/translation`
OCR payload to translation JSON.
- `services/rendering`
Translation JSON to PDF.
- `runtime/pipeline`
  Overall orchestration layer for translation and rendering.
- `services/README.md`
  Concrete Capability Implementation Layer: Overview.
- `foundation/config`
  Paths, fonts, layout, and runtime default configuration.
- `foundation/shared`
  Input parsing,job Shared capabilities: directories, environment variables, prompt loading, etc.
- `foundation/prompts`
  Editable prompt template.
- `devtools/experiments`
  Experimental process, not part of stable mainline.
- `devtools/tests`
  Test probe and layout experiment.
- `devtools/tools`
  Example scripts, migration tools, and diagnostic scripts.

## Structured output

Unify task outputs to standard. job root below.Rust API Default:

- `DATA_ROOT/jobs/<job-id>/source`
- `DATA_ROOT/jobs/<job-id>/ocr`
- `DATA_ROOT/jobs/<job-id>/translated`
- `DATA_ROOT/jobs/<job-id>/rendered`
- `DATA_ROOT/jobs/<job-id>/artifacts`
- `DATA_ROOT/jobs/<job-id>/logs`

Where:

`ocr/unpacked/` or provider raw directory holds OCR provider original output; MinerU common `layout.json`, Paddle common `paddle_result.json` / `paddle_raw`.
`ocr/normalized/document.v1.json` is the unified OCR input for translation/main rendering pipeline.
`ocr/normalized/document.v1.report.json` records adapter/provider detection, default completion, and schema validation summary.
- `translated/translation-manifest.json` Page references removed. payload are the official products of the translation stage
- `rendered/*.pdf` Is final output PDF
`rendered/typst/` preserves Typst intermediate artifacts for debugging and traceability.
- `artifacts/` place summary、bundle Indexes and other download artifacts
- `logs/` Emit stage logs and structured events.

Current convention:

- Main link priority consumption `document.v1.json`
- `document.v1.json` Official consumption definition: `geometry/content/layout_role/semantic_role/structure_role/policy/provenance`
- If the entry gives raw `layout.json`Perform explicit normalization first, then proceed to main translation.
- raw MinerU Reserved for structure adapterDebugging and tracing no longer implicit data contract in main path.
- If only for troubleshooting, status display, or API Output summary; prioritize consumption. `document.v1.report.json`
Python side uniformly reads report and generates normalization summary via `services/document_schema/reporting.py`.
- `specs/` Save Stage spec JSONCurrently covered:
  - `normalize.spec.json` -> `normalize.stage.v1`
  - `translate.spec.json` -> `translate.stage.v1`
  - `render.spec.json` -> `render.stage.v1`
  - `provider.spec.json` -> `provider.stage.v1`
  - `book.spec.json` -> `book.stage.v1`

## Stage Spec Convention

Rust API to Python worker stable protocol fixed to:

`python -u <entrypoint> --spec DATA_ROOT/jobs/<job-id>/specs/<stage>.spec.json`

Conventions are as follows:

- spec Save only stage inputs, parameters, and job Cite, no longer put. Python Expose internal implementation details to Rust
- `job.job_root` Path derivation anchor; used internally across stages. `job_dirs.py` Derivation `source/ocr/translated/rendered/artifacts/logs`
- Do not write secrets in plaintext. spec
Translation key via `credential_ref=env:RETAIN_TRANSLATION_API_KEY`.
If provider is `mineru`, token via `credential_ref=env:RETAIN_MINERU_API_TOKEN`.
At runtime, Rust injects env vars; Python reads via `stage_specs.resolve_credential_ref(...)`.
- Rust Main workflow and local book/translate All entry points switched. spec-only
  - `run_normalize_ocr.py`
  - `run_provider_ocr.py`
  - `run_translate_only.py`
  - `run_render_only.py`
  - `run_translate_from_ocr.py`
  - `run_document_flow.py`
  - `run_provider_case.py`
  - `run_book.py`
  - `translate_book.py`

Local development entry now unified to stage spec Main path:

`entrypoints/run_provider_case.py` -> local common entry for provider-backed full workflow.
`entrypoints/run_document_flow.py` -> local common entry for normalized-document full flow.
`entrypoints/run_provider_ocr.py` -> local common entry for OCR-only provider flow.
- `services/document_schema/normalize_pipeline.py` -> `normalize.stage.v1`
- `services/translation/translate_only_pipeline.py` -> `translate.stage.v1`
- `services/rendering/workflow/render_only.py` -> `render.stage.v1`
- `services/translation/from_ocr_pipeline.py` -> `book.stage.v1`
- `entrypoints/run_book.py` -> `book.stage.v1`

That is, the actual execution standard of the current "top-level entire process" is:

- Local:`run_book.py --spec .../book.spec.json`
- Rust APICreate jobby Rust Generate `specs/*.spec.json` Start sequentially worker
- Test script: regression only, not main execution path.

## Python Depend on source of truth.

Python dependencies consolidated to repository root: [`pyproject.toml`](/home/wxyhgk/tmp/Code/pyproject.toml).

Do not manually edit these requirement files:

- [`docker/requirements-app.txt`](/home/wxyhgk/tmp/Code/docker/requirements-app.txt)
- [`docker/requirements-test.txt`](/home/wxyhgk/tmp/Code/docker/requirements-test.txt)
- [`desktop/requirements-desktop-posix.txt`](/home/wxyhgk/tmp/Code/desktop/requirements-desktop-posix.txt)
- [`desktop/requirements-desktop-windows.txt`](/home/wxyhgk/tmp/Code/desktop/requirements-desktop-windows.txt)
- [`desktop/requirements-desktop-macos.txt`](/home/wxyhgk/tmp/Code/desktop/requirements-desktop-macos.txt)

After modifying dependencies, run all:

```bash
python backend/scripts/devtools/sync_python_requirements.py --repo-root .
```

Check for drift only:

```bash
python backend/scripts/devtools/sync_python_requirements.py --repo-root . --check
```

Compatibility Notes.

- If the old task directory is still `originPDF/jsonPDF/transPDF/typstPDF`, the current backend will directly reject detail/Download interface rerun task generate standard. schema
- Old per-page translation JSON Direct scan mode has exited the mainline;render-only Required `translation-manifest.json`

## Subdirectory docs

- [PIPELINE_DIRECTORY_MAP.md](./PIPELINE_DIRECTORY_MAP.md)
- [foundation/config/README.md](./foundation/config/README.md)
- [foundation/shared/README.md](./foundation/shared/README.md)
- [runtime/pipeline/README.md](./runtime/pipeline/README.md)
- [services/README.md](./services/README.md)
- [services/ocr_provider/README.md](./services/ocr_provider/README.md)
- [services/translation/README.md](./services/translation/README.md)
- [services/translation/orchestration/README.md](./services/translation/orchestration/README.md)
- [services/translation/continuation/README.md](./services/translation/continuation/README.md)
- [services/translation/policy/README.md](./services/translation/policy/README.md)
- [services/rendering/README.md](./services/rendering/README.md)
- [services/mineru/README.md](./services/mineru/README.md)

## Design Boundaries

- `services/translation` Do not manipulate directly PDF
- `services/rendering` Translation strategy not predefined.
- `runtime/pipeline` Orchestrates; does not sink to implementation details.
- `foundation/` Does not carry specific business logic.
- `entrypoints/` Entry only, no core implementation.
- `devtools/` Cannot reverse into main dependency chain.

## Architecture check

Daily changes: run at least these two:

- `python3 backend/rust_api/scripts/check_architecture.py`
- `python3 backend/scripts/devtools/check_pipeline_architecture.py`

Second rule handles blocking. Python Main chain easiest revert boundary:

- `runtime/pipeline` re-directly import `services.ocr_provider` / `services.mineru`
- `runtime/pipeline` re-understand provider raw token, e.g. `layoutParsingResults`
- `services/translation` / `services/rendering` Retry provider raw adapter
- `entrypoints/*` Bypass stable entry; connect to deep implementation directly.
- `services/ocr_provider/__init__.py` Discard explicit public export surface.
- `services/ocr_provider/provider_pipeline.py` Discard stable. compat symbol or no longer act as the main chain handoff
- `services/ocr_provider/paddle_*` Reverse dependency `runtime/pipeline` / `services/translation` / `services/rendering`
