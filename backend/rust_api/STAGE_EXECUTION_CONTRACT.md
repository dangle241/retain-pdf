# Stage Execution Contract

This document answers only one question:

**`job_runner` How are they currently driven? stage Stable semantic contracts.**

Related documents:

- Overall architecture boundaries:
  [`RUST_API_ARCHITECTURE.md`](/home/wxyhgk/tmp/Code/backend/rust_api/RUST_API_ARCHITECTURE.md)
- Current running main chain:
  [`CURRENT_API_MAP.md`](/home/wxyhgk/tmp/Code/backend/rust_api/CURRENT_API_MAP.md)
- OCR provider boundaries:
  [`OCR_PROVIDER_CONTRACT.md`](/home/wxyhgk/tmp/Code/backend/rust_api/OCR_PROVIDER_CONTRACT.md)

## 1. Goal

`job_runner` is responsible for connecting the Rust-side job state machine and Python worker execution chains.

Excludes:

- HTTP request parsing
- job view assembly
- OCR provider transport Definition Details

Handles:

- Select Execution Chain
- Write stage spec
- Start Python worker
- Consume stdout/stderr
- Update job runtime status
- Handle timeout / cancel / failure

## 2. Current stage family

Current execution chain split 4 Type:

1. OCR provider transport
2. `normalize`
3. `translate`
4. `render`

Correspond to official. spec：

- `normalize.stage.v1`
- `translate.stage.v1`
- `render.stage.v1`

`provider.stage.v1` Keep for legacy/local `run_provider_case.py` wrapperCurrent production main chain's OCR provider
transport by Rust `ocr_flow` directly orchestrate, then only pass normalize Submit Python worker。

## 3. workflow to stage chain mapping

### 3.1 `workflow=book`

Chain:

```text
OCR child job
  -> provider transport
  -> normalize
parent job
  -> translate
  -> render
```

Here provider transport is Rust runtime logic, not `run_provider_case.py`.

Entry code:

- [translation_flow.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/translation_flow.rs)

### 3.2 `workflow=translate`

Chain:

```text
OCR child job
  -> provider transport
  -> normalize
parent job
  -> translate
```

Do not enter. render。

### 3.3 `workflow=render`

Chain:

```text
reuse source.artifact_job_id
  -> render
```

Entry code:

- [render_flow.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/render_flow.rs)

### 3.4 `workflow=ocr`

Chain:

```text
provider transport
  -> normalize
```

Entry code:

- [ocr_flow/mod.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/ocr_flow/mod.rs)

Current additional constraints:

- `ocr_flow/mod.rs`
is the sole orchestrator of the OCR subflow
- Only it can:
- Choose local upload / remote url transport branch
- Assemble provider client and distribute to specific transport helper
- Assemble normalize stage command
- Hand OCR return subprocess to common `process_runner`
- `ocr_flow/*` Other submodules only handle:
  - provider transport
- workspace/path preparation
- provider result/raw artifact handling
  - source pdf recovery
  - Ready to upload file or remote. source pdf Leaf helper

## 4. Runtime Main Module

### 4.1 `lifecycle`

File:

- [lifecycle.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/lifecycle.rs)

Responsibilities:

- Task enqueued
- Get execution slot
- cancel short-circuit AND queued persistence
- Distribute by workflow to:
  - `ocr_flow`
  - `translation_flow`
  - `render_flow`

Current convention:

- `lifecycle.rs` keeps only runner top-level orchestration
- `should_skip_job_execution(...)`
responsible for cancel / canceled short circuit
- `persist_queued_job(...)`
responsible for queued state persistence
- `dispatch_workflow(...)`
responsible for workflow -> runner flow dispatch
- `persist_failed_job(...)`
  Failure cleanup
- `clear_job_cancel_request(...)`
  Unified cleanup. cancel registry

### 4.2 stage command factory

File:

- [worker_command.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/worker_command.rs)
- [worker_command/stage_specs.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/worker_command/stage_specs.rs)
- [worker_command/entrypoints.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/worker_command/entrypoints.rs)

Responsibilities:

- Write stage spec
- Choose Python entry
- Generate final command

### 4.3 `worker_process`

File:

- [worker_process.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/worker_process.rs)

Responsibilities:

- Start Python worker
- Inject env
- Terminate process tree

### 4.4 `process_runner`

File:

- [process_runner.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner.rs)
- [process_runner/startup.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/startup.rs)
- [process_runner/execution.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/execution.rs)
- [process_runner/result_support.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/result_support.rs)
- [process_runner/timeout_support.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/timeout_support.rs)
- [process_runner/failure_ai_diagnosis.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/failure_ai_diagnosis.rs)
- [process_runner/io_support.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/io_support.rs)

Responsibilities:

- `process_runner.rs`
keeps only the orchestrator
- `startup.rs`
start worker, write running initial state
- `execution.rs`
read stdout/stderr, process wait, handle exit code, timeout branch
- `result_support.rs`
backfill `ProcessResult`
- `timeout_support.rs`
  timeout State Materialization and Persistence
- `failure_ai_diagnosis.rs`
  AI failure diagnosis
- `io_support.rs`
stdout/stderr consumption policy; leaf helper only takes `JobPersistDeps + canceled_jobs`

### 4.5 `runtime_state`

File:

- [runtime_state.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/runtime_state.rs)

Responsibilities:

- Maintenance. artifacts/runtime/failure Runtime Changes

## 5. Runtime State Semantics

Current job status：

- `queued`
- `running`
- `succeeded`
- `failed`
- `canceled`

Common stage：

- `queued`
- `ocr_submitting`
- `ocr_upload`
- `mineru_processing`
- `normalizing`
- `translating`
- `rendering`
- `finished`
- `failed`
- `canceled`

Rules:

- `status` Final state classification
- `stage` is the current execution stage
- `stage_detail` Runtime documentation for human readers.

Don't embed business logic. `stage` in the text.

## 6. stdout contract

Python worker Approved. stdout Return execution trace.

Current important tags:

- [stdout_parser/mod.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/stdout_parser/mod.rs)

For example:

- `job root`
- `source pdf`
- `layout json`
- `normalized document json`
- `normalization report json`
- `translations dir`
- `output pdf`
- `summary`

Rules:

- Add Rust To be consumed worker Prioritize when generating artifacts. stdout label contract
- Don't let route/service layer directly guess Python output directory

## 7. timeout / cancel contract

### 7.1 cancel

Current cancel has two layers:

- cancel registry
- process termination

Module:

- [cancel_registry.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/cancel_registry.rs)
- [worker_process.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/worker_process.rs)

Semantics:

- job Marked cancel after,runner Will attempt to terminate process tree.
- `normalizing` Phase allows limited continuation to finalize.

### 7.2 timeout

Semantics:

- timeout Seconds from `request_payload.runtime.timeout_seconds`
- After timeout runner is responsible for killing worker
- Then job Mark as `failed`

Current details:

- `normalizing` -> `normalization timeout`
- Other provider transport Phase -> `provider timeout`

## 8. Success and failure criteria

`process_runner` groups current process results into 4 categories:

- `Canceled`
- `Succeeded`
- `SucceededWithShutdownNoise`
- `Failed`

That is:

- Exit code not sole criterion.
- If artifacts Already fully written, some... Python shutdown noise Will be considered successful.

This part of the rules focuses on:

- [process_runner.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner.rs)

## 9. artifacts contract

`job_runner` Current core dependencies artifacts Fields include:

- `job_root`
- `source_pdf`
- `layout_json`
- `normalized_document_json`
- `normalization_report_json`
- `translations_dir`
- `output_pdf`
- `summary`
- `provider_raw_dir`
- `provider_zip`
- `provider_summary_json`

Rules:

- stage When switching, try to pass through. artifacts Pass downstream input
- Don't make downstream guess paths.
- Rust-side readiness judgment centers on:
  - [stage_contract.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/stage_contract.rs)
  - [process_contract.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_contract.rs)
- `stage_contract.rs` Decide to cross stage Whether it can continue:
  - OCR -> translate requires `source_pdf`、`normalized_document_json`
- translate -> render requires `source_pdf`, `translations_dir`, `translation-manifest.json`
- `process_contract.rs` decides whether Python worker exited successfully?
- normalize worker requires `normalized_document_json`, `normalization_report_json`
- translate worker requires `translations_dir`, `translation-manifest.json`, `summary`
- render worker requires `output_pdf`, `summary`
- job detail API Will pass `data.contracts` Expose these. readiness Check, for frontend display and debugging.
- job events API Will remain in failed state. `failure_classified` / `job_terminal` Event `payload.contracts`
  Include same file. readiness Structure, avoid extra frontend requests on failure display. detail。
- Python worker Publish artifact should preferentially output structured stdout JSON：
  `{"event_type":"artifact_published","payload":{"artifact_key":"...","path":"..."}}`。
  Rust `stdout_parser` Consumes the structured event and updates. `JobArtifacts`; old `xxx: path`
  Labels retained as compatibility path.

## 10. Team collaboration red lines

### Red line 1

When adding a stage or modifying fields, first change:

- `commands/stage_specs.rs`

Don't modify yet. route Parameters.

### Red line 2

When adding a worker entry, first modify:

- `commands/entrypoints.rs`

Don't write temporary commands in `process_runner`.

### Red line 3

Add Cancellation/For timeout semantics, prioritize:

- `cancel_registry.rs`
- `worker_process.rs`
- `process_runner.rs`

Don't fill in one copy each in `translation_flow` / `render_flow`.

### Red line 4

When adding artifacts path semantics:

- worker produce -> stdout label contract
- Rust consumption -> `stdout_parser` + `runtime_state`

Don't parse Python directory structure directly in route/service layer.

## 11. Recommended change path

### Scenario 1: Add a new Python stage

Order:

1. `commands/stage_specs.rs`
2. `commands/entrypoints.rs`
3. Corresponding flow module
4. `stdout_parser`
5. `runtime_state`

### Scenario 2: Adjust OCR child -> parent handover fields

Order:

1. `ocr_flow/mod.rs`
2. `translation_flow.rs`
3. `runtime_state.rs`

### Scenario 3: Adjust render-only input source

Order:

1. `render_flow.rs`
2. `storage_paths`
3. Add if needed. presentation summary

## 12. One-sentence constraint

`job_runner` The stability boundary should be:

- Upstream provide it `JobRuntimeState`
- Passes. spec Driver Python worker
- It retrieves run results via stdout/artifacts
- It job Status update reply Rust Persistence layer

Other responsibilities should not be added here.
