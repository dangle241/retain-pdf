# job_runner boundaries

This document answers only one question:

Where should logic be placed when modifying backend/rust_api/src/job_runner?

job_runner is the runtime execution layer, not the HTTP API layer or view/presentation layer. It is responsible for taking the already‑created job and running it for real: queueing, dispatching workflows, starting Python workers, consuming stdout/stderr, syncing runtime state, processing OCR provider transport, and handling failures/cancellations/timeouts.

## General rules

`job_runner` Handles runtime execution only; does not perform the following:

- Does not parse HTTP request。
- Do not assemble for external use. API view。
- Do not directly depend. `AppState`。
- Frontend display details unclear. Specify component, layout, or data mapping.
- Do not expose provider raw private structures as published artifacts.
- Do not pass the full ProcessRuntimeDeps to leaf helpers.

Maintain dependency direction:

```text
services/jobs -> job_runner -> worker_command / ocr_provider / db facade
```

`job_runner` Internally, distinguish by two dependency types.

- `ProcessRuntimeDeps`
  orchestrator Layer usage, e.g. workflow AssignOCR flow、process runner Main entry point.
- `JobPersistDeps`
  leaf helper Use, only need `db + data_root + output_root` Do not take the whole package. runtime deps。

## Top-level module

### `mod.rs`

Purpose:

- `job_runner` facade。
- Export runner Entry and Minimal Runtime State helper。
- Mount internal submodule.

Don't add.

- workflow Business logic.
- provider Branch details.
- stdout rules.
- Download/Unpack implementation.

### `lifecycle.rs`

Purpose:

- job Queue.
- Execute slot control.
- cancel Short circuit.
- Assign to OCR/translation/render/process runner based on workflow.

Do not place:

- Specific OCR provider logic.
- Python stdout Parsing rules.
- Single worker completion state details.

## process runner

Entry point:

- `process_runner.rs`

Boundary:

- `process_runner.rs`
Keep only the worker execution orchestrator: start, collect execution results, and dispatch timeout/completion.
- `process_runner/startup.rs`
Worker startup, PID persistence before startup, and cancellation checks.
- `process_runner/execution.rs`
  Wait for processes, collect. stdout/stderrDistinguish completed/timed out。
- `process_runner/completion.rs`
  Completion status classificationshutdown noise Determination, final state application.
- `process_runner/completion_pipeline.rs`
  Final step after completion: mount. stdout/stderrVerify worker output contractApp state: completed failed AI diagnosis.
- `process_runner/timeout_support.rs`
  timeout Failure state.
- `process_runner/io_support.rs`
  stdout/stderr Consume.
- `process_runner/result_support.rs`
  process Write back result. job。
- `process_runner/failure_ai_diagnosis.rs`
AI failure diagnosis.

Rules:

- When adding a new worker, required artifact validation after success should be placed in process_contract.rs, called by completion_pipeline.rs.
- New stdout label parsing should not be placed in the process runner; put it in stdout_parser/*.
- New Python worker command args should not be placed in the process runner; put them in worker_command/*.

## workflow flow

### `translation_flow.rs` + `translation_flow_*.rs`

Purpose:

- book / translate‑only workflow orchestration.
- OCR child job Create and sync status with parent task.
- OCR Enter after completion. translation。
- translation Press when done. `PipelinePlan` Decide whether to enter render。

Boundary:

- `translation_flow.rs`
  orchestrator。
- `translation_flow_child.rs`
Upload source reading, parent task entering OCR submitting, and OCR child creation.
- `translation_flow_artifacts.rs`
  From existing OCR artifacts Input preparation for continuing translation.
- `translation_flow_stage.rs`
translation/render stage invocation and ocr_child_finished event.
- `translation_flow_executor.rs`
Execute the translation next plan.
- `translation_flow_support.rs`
  OCR child Final state determination and parent task closure.

Rules:

- Do not directly read/write artifact details in translation_flow.rs; reuse existing artifacts via translation_flow_artifacts.rs.
- Don't spell here. Python Command; command construction at `worker_command/*`。

### `render_flow.rs` + `render_flow_artifacts.rs`

Purpose:

- render‑only workflow orchestration.
- Prepare render input from existing translation artifacts.

Rules:

- `render_flow.rs` Only responsible for construction. render commandSet running/rendering Status, Call process runner。
- Reading source job, copying translation inputs, and validating translations dir/source pdf should be in render_flow_artifacts.rs.

## OCR flow

Entry point:

- `ocr_flow/mod.rs`

Boundary:

- `ocr_flow/mod.rs`
OCR child job orchestrator: initialize state, ready workspace, execute provider transport, enter normalize worker.
- `ocr_flow/provider_transport.rs`
Local upload/remote URL, MinerU/Paddle provider dispatch.
- `ocr_flow/workspace.rs`
  OCR job Path and directory preparation.
- `ocr_flow/transport.rs`
  source pdf Preparation and Remote source recovery.
- `ocr_flow/support.rs`
OCR job saving, parent task OCR status mirroring, transport/source‑pdf failure handling.
- `ocr_flow/status.rs`
  provider status Map to job stage/detail/progress。
- `ocr_flow/polling.rs`
General poll wait, timeout, and cancellation checks.

### MinerU

- `ocr_flow/mineru.rs`
MinerU submit local entry batch and remote task two‑step provider invocation.
- `ocr_flow/mineru_polling.rs`
  MinerU batch/task polling loop。
- `ocr_flow/mineru_status_handlers.rs`
  MinerU batch/task Status handling,done Back provider resultand enter bundle Download.
- `ocr_flow/mineru_retry.rs`
  MinerU query retry Strategy, retryable error identification.
- `ocr_flow/bundle_download.rs`
  MinerU bundle Overall orchestration after success:readiness wait、download retry、unpack、markdown export。
- `ocr_flow/bundle_ready_wait.rs`
  bundle readiness probe Wait and degraded fallback。
- `ocr_flow/bundle_download_retry.rs`
  bundle Retry actual download.
- `ocr_flow/bundle_events.rs`
  bundle retry/degraded Events and `ocr_result_ready` Status marker.
- `ocr_flow/bundle_retry_policy.rs`
  bundle retry/fallback/timeout Pure strategy.
- `ocr_flow/markdown_bundle.rs`
  provider raw markdown Export

Rules:

- provider API Prioritize protocol fields. `ocr_provider/mineru/*`。
- Job status updates go into ocr_flow/status.rs or status handlers.
- retry Judgment Release retry/policy Module, do not insert. polling loop。
- bundle Download event unified go `bundle_events.rs`。

### Paddle

- `ocr_flow/paddle.rs`
Paddle submit/poll/download main flow.
- `ocr_flow/paddle_payload.rs`
Paddle optional payload construction.
- `ocr_flow/paddle_errors.rs`
  Paddle provider error Mount to job。
- `ocr_flow/paddle_markdown.rs`
  Paddle markdown artifact materialize。

Rules:

- Paddle Do not write request parameters in transport orchestrator External random positions, place uniformly. `paddle_payload.rs`。
- Paddle Error mappings must not be scattered. polling Unified routing. `paddle_errors.rs`。

## stdout parser

Entry point:

- `stdout_parser/mod.rs`

Boundary:

- `labels.rs`
  stdout label Constants.
- `state.rs`
  stdout parser Shared state helper。
- `artifact_fields.rs`
  stdout label / structured artifact key Internal artifact field mapping of.
- `artifact_rules.rs`
Artifact row and artifact_published JSON event written to job artifacts.
- `metric_rules.rs`
  `pages processed`、`translated items`Performance metrics
- `stage_rules.rs`
  stdout Row-triggered stage Change.
- `failure.rs`
  provider failure Attribution.

Rules:

- artifact Module write-only. artifact, does not advance stage。
- stage Advance only `stage_rules.rs`。
- metric Don't inject artifact。
- New stdout labels must also consider whether they belong to artifact, metric, stage, or failure.

## Contract module

### `process_contract.rs`

Purpose:

- Determine the worker type based on the worker command.
- Validate required artifacts after successful worker exit.

Rules:

- Python worker Exited successfully but missing critical artifacts; should fail here.
- Do not customize stage product determination in the process runner main flow.

### `stage_contract.rs`

Purpose:

- Parse required inputs from existing job artifacts: OCR -> translation, translation -> render.
- Validate source pdf, normalized document, translations manifest, and other stage‑ready conditions.

Rules:

- Retry, resume, and from‑artifacts workflows reuse this ready input parsing.
- Do not add duplicate artifact path parsing inside flows.

### `artifact_requirements.rs`

Purpose:

- Shared artifact path parsing and file/directory existence checks.

Rules:

- Only perform path and existence checks.
- Unclear. Specify file path, command, error message, code snippet, or context. workflow。

## Stop splitting when abstraction cost exceeds reuse benefit. YAGNI.

Don't split cases further just to inflate line count.

- Module already has only a single algorithm responsibility, for example page range parsing or retry strategy.
- After splitting, the call chain is harder to read than before.
- Requires import trait/generic Only then can minor duplication be eliminated.
- Just two. poll loop Looks similar, but parameters, error messages, and status handling differ.

Prioritize splitting these cases:

- Same file contains both orchestration and provider protocol details.
- The same function simultaneously performs state checking, event logging, file path resolution, and process control.
- Some leaf helper Path or URL not found. db Write received full packet. `ProcessRuntimeDeps`。
- artifact、stage、metric、failure rules mixed together.

## Minimal validation

After modifying job_runner, run at least:

```bash
cargo test --manifest-path backend/rust_api/Cargo.toml ocr_flow -- --nocapture
cargo test --manifest-path backend/rust_api/Cargo.toml stdout_parser -- --nocapture
cargo test --manifest-path backend/rust_api/Cargo.toml process_runner -- --nocapture
cargo test --manifest-path backend/rust_api/Cargo.toml
```

If only a small module is changed, run the corresponding filter first; run the full suite before finalizing Rust API tests.
