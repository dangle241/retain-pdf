# MinerU Integration notes

This layer is only responsible for MinerU access, not responsible for translation strategy, nor PDF rendering.

If you are currently focusing on "external OCR API How to abstract independently, not couple to current workflow. Read first:

- `scripts/services/ocr_provider/README.md`

services/mineru/ is the specific implementation of the MinerU provider.

## Scope boundary

- Submit tasks to MinerU
- Query task status
- Download and unpack MinerU results
- In the standard job root, organize MinerU provider primary write output source/, ocr/unpacked/, and ocr/normalized/
- Keep raw layout.json for adapter debug and trace use.
- Produce a unified middleware layer. `document.v1.json`

Not done here:

- Do not do OCR post-processing
- Do not do translation
- Do not do PDF rendering
- Do not decide the fast/sci/precise translation strategy.

## Recommended entry points

- `scripts/entrypoints/run_provider_case.py`
  When used locally by humans, prioritize this generic entry name. It is a neutral entry name, does not provider hardcoded names.
- `mineru_pipeline.py`
  `entrypoints/run_provider_case.py` Underlying stable implementation.
- `mineru_job.py`
  Only parse and unpack; suitable to take first. MinerU result and then manually connect translation.
- `mineru_api.py`
  Bottom API Encapsulate calls; call directly only when necessary. MinerU Use when interfacing.
- `scripts/devtools/tools/mineru_api_example.py`
  Minimal example. Use to test API connectivity and inspect response structure.

## Directory structure

- `<job-root>/source`
- `<job-root>/ocr`
- `<job-root>/translated`
- `<job-root>/rendered`
- `<job-root>/artifacts`
- `<job-root>/logs`

## Default convention

- MinerU The phase produces concurrently:
  - `ocr/unpacked/layout.json`
  - `ocr/normalized/document.v1.json`
  - `ocr/normalized/document.v1.report.json`
- Provide source text./Main render pipeline defaults require and prioritize. `ocr/normalized/document.v1.json`
- `ocr/unpacked/layout.json` Reserved for adapters, debugging, and backtracking; no longer implicit in the main path. fallback
- `content_list_v2.json` Currently for experiment and adaptation only, not the main path.
- If you only want to provider / defaults / validation Show summary, read first. `document.v1.report.json`

Responsibility Breakdown:

- `document_v1.py`
Only responsible for MinerU's layout.json -> document.v1.json
- `artifacts.py`
Only responsible for MinerU artifact path and provider internal file organization
- `contracts.py`
Only responsible for MinerU provider private artifact filenames and directory names
- `job_flow.py`
  Only responsible for task orchestration, download and extraction, and persistence.
- `mineru_pipeline.py`
  Only handles the normalized. OCR feed input into translation/Main Rendering Pipeline

Note:

- Main Story `pipeline_summary.json`、stdout labels、source-json selection rules have all been consolidated into `services/pipeline_shared/`
- `services/mineru/` No longer bear any shared spec shell.

Link passed. `services/document_schema/adapters.py` Expose as unified adapter，
That is, MinerU no longer leaks raw structure into the translation mainline.

## Relationship to main flow

Typical chain:

1. mineru_job.py or mineru_pipeline.py submits the PDF to MinerU
2. Poll until task completes.
3. Download and unpack result
4. Copy the original PDF to source
5. Place parsing result into `ocr/unpacked`
6. Generate simultaneously `ocr/normalized/document.v1.json`
7. Continued by runtime/pipeline calling services/translation and services/rendering to complete remaining steps.

Currently, a copy of pipeline_summary.json will also be written inside schema_validation for quick confirmation.
Does the normalized document meet current requirements? `document.v1` Contract; also includes. `normalization_report`
and normalization_summary to avoid outer layer re-parsing raw OCR.

That is, this layer's responsibility is to "take" PDF Make it consumable by the main pipeline. OCR "Input", not handle follow-up operations.

## Provider Stage Spec

`provider.stage.v1` Now primarily reserved for local. provider-case helper Compatibility paths:

`python -u scripts/entrypoints/run_provider_case.py --spec <job_root>/specs/provider.spec.json`

In the production main chain, Rust API is responsible for provider-backed OCR flow per the request. OCR provider dispatches MinerU/Paddle transport, produces provider raw input after results. normalize, translate, and render phases. MinerU provider only maintains MinerU API semantics and raw artifact organization; does not define upper-layer book workflow contract.

Security Conventions:

- Do not write MinerU token directly to disk spec or job artifact
- Compatible provider spec use: credential_ref=env:RETAIN_MINERU_API_TOKEN
- Translation key also uses credential_ref=env:RETAIN_TRANSLATION_API_KEY

Compatibility notes:

- If the old task directory still has originPDF/jsonPDF/transPDF/typstPDF, the current backend will directly reject detail/download API rerun tasks.

## Collaboration rules

If OCR this part is maintained separately by assigned personnel; here we are only responsible for 'obtaining' provider results and structuring them for main pipeline consumption as OCR input.

- Allow editing here provider API Access, download and unpack, organize task directories, and provider Side Compatibility
- Do not directly add translation rules, terminology logic, or PDF Rendering logic
- If downstream required fields are insufficient, prioritize pass-through. `document_schema` Promote to stable field; do not raw provider Fields directly exposed to translation / rendering
- If changed OCR Artifact directory conventionsstdout Tag or main chain input location must update synchronously. `document_schema`、`runtime/pipeline` and corresponding tests
