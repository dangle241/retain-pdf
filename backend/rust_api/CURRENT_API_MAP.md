# Current API Map

This document only answers one question:

**Current set Rust API + Python workerhow it actually runs.**

Current mainnet only.

## Quick navigation

- Documentation main entry.
  [`README.md`](/home/wxyhgk/tmp/Code/backend/rust_api/README.md)
- Only look at the currently running main chain:
  [`CURRENT_API_MAP.md`](/home/wxyhgk/tmp/Code/backend/rust_api/CURRENT_API_MAP.md)
- View only Rust Module boundaries:
  [`RUST_API_ARCHITECTURE.md`](/home/wxyhgk/tmp/Code/backend/rust_api/RUST_API_ARCHITECTURE.md)
- OCR provider Boundaries only:
  [`OCR_PROVIDER_CONTRACT.md`](/home/wxyhgk/tmp/Code/backend/rust_api/OCR_PROVIDER_CONTRACT.md)
- stage Runtime contract only:
  [`STAGE_EXECUTION_CONTRACT.md`](/home/wxyhgk/tmp/Code/backend/rust_api/STAGE_EXECUTION_CONTRACT.md)
- External only API Protocol:
  [`API_SPEC.md`](/home/wxyhgk/tmp/Code/backend/rust_api/API_SPEC.md)
- View rendering parameter specifications:
  [`RENDER_OPTIONS_CONTRACT.md`](/home/wxyhgk/tmp/Code/backend/rust_api/RENDER_OPTIONS_CONTRACT.md)

## 1. Current system layering

Now the backend is split into two layers:

### Rust layer

Responsibilities:

- External HTTP API
- authentication
- job Create / Queue / State machine
- SQLite Persist
- artifact / event Query
- Start Python worker

Main entry point:

- [`src/routes/jobs/mod.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/routes/jobs/mod.rs)
- [`src/services/jobs/*`](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs)
- [`src/job_runner/*`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner)

### Python layer

Responsibilities:

- OCR provider calls
- raw OCR -> normalized `document.v1.json`
- Translation
- Rendering
- PDF merge / post-process

Main code entry point:

- [`backend/scripts/entrypoints/run_provider_case.py`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints/run_provider_case.py)
- [`backend/scripts/entrypoints/run_provider_ocr.py`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints/run_provider_ocr.py)
- [`backend/scripts/entrypoints/run_normalize_ocr.py`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints/run_normalize_ocr.py)
- [`backend/scripts/entrypoints/run_translate_only.py`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints/run_translate_only.py)
- [`backend/scripts/entrypoints/run_render_only.py`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints/run_render_only.py)

## 2. Current production workflow

Now externally stable. workflow Only these:

- `book`
  Meaning:provider-backed Full Process
  Link:OCR -> Normalize -> Translate -> Render

- `translate`
Meaning: OCR -> Normalize -> Translate
  Do nothing. render

- `render`
  Meaning: Reuse existing translation artifacts, only do render

- `ocr`
Meaning: OCR-only / provider-only Subprocess

Note:

- `book` This is the formal version of the current complete main chain. API Identifier
- **No** `mineru`
- OCR provider Choose not to rely workflow, but by `ocr.provider`

## 3. Current provider Selection method

Current provider Distribution channel:

- `workflow = book`
- `ocr.provider = mineru | paddle | local | <configured local_command provider>`

That is:

- `workflow` Choose which main process to run.
- `ocr.provider` determine OCR which to use provider
- `GET /api/v1/providers/ocr` Discovered by frontend and external integrators. provider credential/options/capabilities Entry
- provider-specific Non-secret parameters go in `ocr.options`；multipart helper Usage JSON String Field `ocr_options`

Key code:

- Rust write spec：
  - [`src/worker_command.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/worker_command.rs)
- Python by provider Distribution:
  - [`backend/scripts/services/ocr_provider/provider_pipeline.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/provider_pipeline.py)

Note: Production main chain. `book` job Stopped. `run_provider_case.py` as the initial command.`book` job Save only on creation.
`book-workflow-rust-orchestrated` Placeholder command, actual execution by Rust `job_runner` Serializes OCR child、normalize、
translate、render stage。

## 4. Current official protocol:Stage Spec

Rust and Python worker Protocol between us already obsolete. CLI parameters, but rather:

```bash
python -u <entrypoint> --spec <job_root>/specs/<stage>.spec.json
```

Current official stage：

- `normalize.stage.v1`
- `translate.stage.v1`
- `render.stage.v1`

legacy/local helper stage：

- `provider.stage.v1`
- `book.stage.v1`

Corresponds Python loader：

- [`backend/scripts/foundation/shared/stage_specs.py`](/home/wxyhgk/tmp/Code/backend/scripts/foundation/shared/stage_specs.py)

## 5. Rust to Python Actual execution chain

Most important `book` Example:

### Step 1: Frontend / Caller sends request

Typical entry point:

- `POST /api/v1/jobs`

Rust Routing:

- [`src/routes/jobs/create.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/routes/jobs/create.rs)
- [`src/services/jobs/facade.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs/facade.rs)

### Step 2:Rust Create job

Responsible:

- Validate Request
- Generate job snapshot
- Persist to DB
- Enter Queue

Main code:

- [`src/services/jobs/creation`](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs/creation)
- [`src/services/job_snapshot_factory.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/job_snapshot_factory.rs)
- [`src/services/job_launcher.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/job_launcher.rs)

Note:

- route Layer now tries to only do HTTP Adaptation
- `jobs` All relevant use cases have been uniformly pre-processed. `JobsFacade`
- `uploads` / `glossaries` also respectively passed `upload_api` / `glossary_api`

### Step 3:Rust Assemble workflow plan

Rust According to workflow Select run plan:

- `book` -> Rust Orchestration `OCR child -> normalize -> translate -> render`
- `translate` -> Rust orchestrates `OCR child -> normalize -> translate`
- `render` -> Rust Reuse artifact Delayed start `render`
- `ocr` -> Rust orchestrates `provider transport -> normalize`

Main code:

- [`src/job_runner/lifecycle.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/lifecycle.rs)
- [`src/job_runner/translation_flow.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/translation_flow.rs)
- [`src/job_runner/ocr_flow/mod.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/ocr_flow/mod.rs)
- [`src/job_runner/render_flow.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/render_flow.rs)

### Step 4: Rust writes spec by stage and starts worker spec and start worker

`book` Mainnet phases written.

- OCR child/provider transport：Rust Internal provider transport, not through `provider.stage.v1`
- `DATA_ROOT/jobs/<job_id>/specs/normalize.spec.json`
- `DATA_ROOT/jobs/<job_id>/specs/translate.spec.json`
- `DATA_ROOT/jobs/<job_id>/specs/render.spec.json`

`provider.spec.json` / `provider.stage.v1` for OCR-only provider worker and legacy provider-case/local helper.
Current `book` orchestrator continues Rust internal OCR child transport then enters normalize/translate/render stage.

Rendering strategy also included. `render` Centralized configuration. Current default:

- `render.source_cleanup_strategy = "pikepdf_text_strip"`
- Meaning: Default first. pikepdf by bbox Delete original PDF content-stream text-opCode duplication. Remove. Typst translation blocks with background color for visual overlay
- Available values:`typst_fill | pikepdf_text_strip | bbox_text_strip | legacy | redact_restore_formulas`
- `pikepdf_text_strip` Pre-render hook missing. Implement: `componentDidMount` in React. pikepdf Apply to path level content-stream text-op Delete, then Typst Background block cover visually. Simplify: inline style, add when complex layout needed.`bbox_text_strip`、`legacy`、`redact_restore_formulas` Currently all are compatibility aliases; behavior identical. `pikepdf_text_strip`

### Step 5:job_runner Enter runtime main chain.

Current actual entry:

- [`src/app/jobs.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/jobs.rs)
Compress `AppState` into `ProcessRuntimeDeps`
- [`src/job_runner/lifecycle.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/lifecycle.rs)
Responsible for queuedSlot executeworkflow Distribution

### Step 6:Rust Start Python worker

This will make it necessary. env Inject:

- `RETAIN_TRANSLATION_API_KEY`
- `RETAIN_MINERU_API_TOKEN`
- `RETAIN_PADDLE_API_TOKEN`

Main code:

- [`src/job_runner/process_runner.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner.rs)
- [`src/job_runner/process_runner/startup.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/startup.rs)
- [`src/job_runner/process_runner/execution.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/execution.rs)
- [`src/job_runner/worker_process.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/worker_process.rs)

### Step 7:Python stage worker Execute

Production main chain currently uses these. stage worker：

- `run_normalize_ocr.py --spec specs/normalize.spec.json`
- `run_translate_only.py --spec specs/translate.spec.json`
- `run_render_only.py --spec specs/render.spec.json`

`run_provider_case.py` Keep as legacy/local wrapperfor local one-time verification. provider-backed Full process; do not treat it as.
Rust API Main Production Chain Entry.

## 6. Current primary output directory

Each job Standard directory:

- `DATA_ROOT/jobs/<job_id>/source`
- `DATA_ROOT/jobs/<job_id>/ocr`
- `DATA_ROOT/jobs/<job_id>/translated`
- `DATA_ROOT/jobs/<job_id>/rendered`
- `DATA_ROOT/jobs/<job_id>/artifacts`
- `DATA_ROOT/jobs/<job_id>/logs`
- `DATA_ROOT/jobs/<job_id>/specs`

Key files:

- `specs/normalize.spec.json`
- `specs/translate.spec.json`
- `specs/render.spec.json`
- `ocr/result.json`
- `ocr/normalized/document.v1.json`
- `ocr/normalized/document.v1.report.json`
- `translated/translation-manifest.json`
- `artifacts/render_config.json`
- `artifacts/pipeline_summary.json`
- `rendered/*.pdf`

## 7. Most critical data contract

Now translation / rendering Main chain depends on normalized document。

Official field definitions:

- `geometry`
- `content`
- `layout_role`
- `semantic_role`
- `structure_role`
- `policy`
- `provenance`

Compatibility fields may also exist:

- `type`
- `sub_type`
- `bbox`
- `text`
- `lines`
- `segments`

But these are no longer the recommended primary contract.

## 8. Current entry point criteria

Production Main Chain Entry:

- Rust job_runner orchestrates by workflow
- Python stage worker Execute single only. stage

Reserved local / legacy wrapper：

- `run_provider_case.py`
- `run_document_flow.py`

Current principle:

- Entry point authentication Rust `job_runner`
- Main Protocol Agreement `normalize.stage.v1`、`translate.stage.v1`、`render.stage.v1`
- `provider.stage.v1` Only as legacy provider-case/local helper Contract
- main summary File Recognition `pipeline_summary.json`

## 9. Current event and failure closure

The current official event stream is already:

- Python worker writes DATA_ROOT/jobs/<job_id>/logs/pipeline_events.jsonl
- Rust Merge query layers DB events and pipeline_events.jsonl
- for book / translate This type creates. OCR child of the main task, GET /api/v1/jobs/<job_id>/events Also merges. OCR Subtask Events of {job_id}-ocr
- OCR Subtask events map to the main task. Original source job_id is placed in payload.source_job_id and payload.source_event
- Rust detail/list Use first live pipeline stage Snapshot, not stale DB `job.stage`

Recommended entry for frontend progress display:

- Current state read-only GET /api/v1/jobs/<job_id> or GET /api/v1/jobs inside stage_snapshot
- `events` Only history, timeline, and troubleshooting; no current-phase judgment.
- No polling needed. `{job_id}-ocr`
- OCR / Translation / Historical event rendering: still look at events inside:
  - `display_stage`
  - `stage`
  - `substage`
  - `lane`
  - `stage_detail`
  - `event_type`
  - `progress.unit`
  - `progress.current`
  - `progress.total`

Current recommended progress unit:

- OCR provider Page progress:`display_stage=ocr`, `stage=ocr_processing`, `progress.unit=page`
- Translation batch progress:`display_stage=translation`, `stage=translating`, `progress.unit=batch`
- Page-level sub-stage:`continuation_review`, `page_policies`, `domain_inference`, `garbled_repair`, `progress.unit=page`
- Rendering page progress:`display_stage=render`, `stage=rendering`, `progress.unit=page`
- Typst compile / overlay / savingUse when unable to report by page. `progress.unit=step`

Current official failure criterion is now:

- `data.failure`

Compatibility fields retained; role fixed:

- `data.failure_diagnostic`
Only as failure Compatible Projection
- `events[*].event`
  Compatible with old clients; new clients should read first. `event_type`
- `events[*].message`
  Debug/Compatible copy; formal semantics take priority. `stage_detail` + `event_type`
- `events[*].raw`
  Save DB / pipeline jsonl / OCR child source information; frontend display must not rely on it for stage determination.

Stage layering rules are now fixed:

- Current front-end display stage placed at `stage_snapshot.display_stage`
- Place Machine Stage `stage`
- `stage_snapshot` is current stage and progress The only truth.
- `background_snapshots` Show only background auxiliary progress, e.g., during translation. `render_prewarm`
- provider Private state in `provider_stage`
- `message` / `stage_detail` Act only as copywriter; do not participate in stage judgment.

## 10. Three key takeaways.

1. `workflow=book` Exactly. provider-backed Full process, no longer `mineru`
2. OCR provider View `ocr.provider`not view workflow DeepSeek
3. Rust and Python Stability boundary is `--spec <stage>.spec.json`

## 11. Logs, config, entry point. Check logs for errors first.

For quick issue triage, check in this order:

### View API What the request looks like

- [`API_SPEC.md`](/home/wxyhgk/tmp/Code/backend/rust_api/API_SPEC.md)

### Look at Rust: which one started? Python Script

- [`src/worker_command.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/worker_command.rs)

### Look at Python provider: how does the main entry point dispatch?

- [`backend/scripts/services/ocr_provider/provider_pipeline.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/provider_pipeline.py)

### Check stage spec Looks like you're asking about appearance. Translate to English: "What does it look like?"

- [`backend/scripts/foundation/shared/stage_specs.py`](/home/wxyhgk/tmp/Code/backend/scripts/foundation/shared/stage_specs.py)

### Check final main chain result

- `DATA_ROOT/jobs/<job_id>/artifacts/pipeline_summary.json`
