# Rust API Architecture

This document answers only one question:

**`rust_api` Current team collaboration boundaries are unclear. Define module ownership and API contracts first. Update `CONTRIBUTING.md` with explicit interface rules.**

Current trunk only. No history. No migration.

Related documents:

- Document entry point:
  [`README.md`](/home/wxyhgk/tmp/Code/backend/rust_api/README.md)
- Table of Contents:
  [`RUST_API_DIRECTORY_MAP.md`](/home/wxyhgk/tmp/Code/backend/rust_api/RUST_API_DIRECTORY_MAP.md)
- Current running main chain:
  [`CURRENT_API_MAP.md`](/home/wxyhgk/tmp/Code/backend/rust_api/CURRENT_API_MAP.md)
- OCR provider boundary:
  [`OCR_PROVIDER_CONTRACT.md`](/home/wxyhgk/tmp/Code/backend/rust_api/OCR_PROVIDER_CONTRACT.md)
- stage runtime contract:
  [`STAGE_EXECUTION_CONTRACT.md`](/home/wxyhgk/tmp/Code/backend/rust_api/STAGE_EXECUTION_CONTRACT.md)
- Rust-side artifact boundary:
[`doc/core/rust_api/10-Rust ä¾§ Artifact Boundary.md`](/home/wxyhgk/tmp/Code/doc/core/rust_api/10-Rust%20%E4%BE%A7%20Artifact%20Boundary.md)
- External API protocol:
  [`API_SPEC.md`](/home/wxyhgk/tmp/Code/backend/rust_api/API_SPEC.md)

## 1. Overall layering

Current `rust_api` Split 6 Layer:

1. `app`
2. `routes`
3. `services` application entry
4. `services` Internal implementation
5. `job_runner`
6. `ocr_provider`

Dependencies must be unidirectional:

```text
app -> routes -> application services -> internal services -> job_runner / ocr_provider
```

No reverse dependencies.

For example:

- `routes` Should not know Python worker how to construct the command
- `job_runner` should not know HTTP Header and JSON envelope
- `ocr_provider` Route layer return structure unknown.

## 1.1 `AppState` Allowed locations

`AppState` Not general DI container. Only allow here:

- `app/*`
  Assembles and holds global resources.
- `axum` route Entry function
  i.e. `State(AppState)` The unpacking layer.
- Few boundary-layer assembly ports.
  Used to `AppState` compress into a narrower deps Structure
- Test helper code

Forbid directly passing `AppState` Propagate to:

- `services` Business implementation main chain
- `job_runner` Runtime main chain
- `ocr_provider`
- presentation / view Assembly Layer

If a module requires resources, the correct approach is:

1. At the boundary layer from `AppState` Extract required fields.
2. Make explicit. deps struct
3. Narrower interface only. deps

Fixed public patterns:

- `routes/common.rs`
responsible for route Common Lightweight Side deps builder, `request_base_url(...)` and `ok_json(...)`
  - `build_jobs_route_deps` → `JobsFacade`
  - `build_library_route_deps` → `LibraryDeps` + `JobsFacade`(Collection initiates translation, etc.) library→job Scenario)
  - `build_glossary_route_deps` / `build_upload_route_deps` / `build_health_route_deps`
- `routes/download_response.rs` / `routes/download_response/**`
File downloadmarkdownãpreviewãcoverãthumbnail response boundary
- `routes/jobs/json_response/**`
responsible for jobs JSON query / debug / Control / retry response boundary
- `app/jobs.rs::build_process_runtime_deps(...)`
responsible for runner Assembly

including runner Side rules have been fixed as:

- `job_runner` Expose Only `ProcessRuntimeDeps::new(...)`
- `AppState -> ProcessRuntimeDeps` Assembly responsibility remains `app/*` boundary layer
- `ProcessRuntimeDeps`
  Keep only orchestrator Level Entry Usage
- `JobPersistDeps`
responsible for `db + data_root + output_root` Persist This Group/Event Resource; Leaf helper Take this first; do not take whole package. runtime deps
- `app/state.rs`
  Responsible only `AppState` Assembly; startup legacy running Task recovery has been pushed down to `app/state_recovery.rs`
- `job_runner/lifecycle.rs`
Keep only runner Top-level orchestration; among them "queued persistence/"Cancel Short-Circuit" and "Press" workflow Dispatch execution should remain small. helperrather than stuffing it back into a big function.

Stop. `AppState` Direct import. `job_runner`。

Forbid in each route File repeats a manually written set of locals. `route_deps(...)`。

## 1.2 Internal contract vs External contract

This boundary must be clear:

- `CreateJobInput` / `ResolvedJobSpec` / `JobSnapshot`
is **Internal runtime contract**
- `JobDetailView` / `JobEventListView` / `TranslationDiagnosticsView`
is **External API Contract**

Internal contract allows holding real. credential：

- `translation.api_key`
- `ocr.mineru_token`
- `ocr.paddle_token`

But these fields can only exist in:

- Runtime memory
- SQLite job record
- worker env Inject
- stage spec's `credential_ref`

No direct entry:

- HTTP JSON response
- external diagnostics / replay / debug payload
- events API payload

Current security adaptation layer has two types:

1. `public_request_payload(...)`
   Responsible for internal `ResolvedJobSpec` Project to externally returnable. request payload
2. `models/redaction.rs`
   Handles any string / JSON payload Unified desensitization

Team Collaboration Rules:

- If adding an external viewFirst determine whether it consumes an internal or external contract.
- Any direct serialization from internal objects to HTTP All changes considered errors by default.
- When adding new secret or updating fields, must sync updates. redaction Module, not local patches in routes.

## 1.3 Configuration layer boundary

`src/config.rs` Compatible. facadeKeep current `AppConfig` Field used by existing callers. Real config grouping in `src/config/*`：

- `paths.rs`
  Process only. root/data/scripts/jobs/uploads/downloads Such paths and runtime Create directory.
- `auth.rs`
handles only `auth.local.json`, API keysConcurrency limit set. simple port.
- `server.rs`
handles only bind host, API port, Python binary.
- `upload.rs`
  Only handle global upload size./Page limit.
- `provider.rs`
handles only MinerU / Paddle / DeepSeek provider runtime, HTTP timeout, retry and provider Upload threshold.
- `job_runner.rs`
  Process queue polling only,worker terminate、AI failure diagnosisSync wait use `await` not manual loops. runner Runtime parameters.
- `env_vars.rs`
only contains env Read helper.

When adding new deployment-tunable parameters, first determine which submodule they belong to; do not continue to env Parse Write Back `config.rs`。`config.rs` Responsible only for:

1. `from_env()` Parse server environment source
2. `from_desktop()` Parse desktop source
3. Internal `AppConfigParts` Assembly compatible `AppConfig`

Don't configure below.

- API path
- stage name
- artifact key / artifact group
- schema version
- stdout label
- external JSON Field name

These are protocol constants, not deployment parameters. Make them env Causes frontend,Python workerTest history. job Explain simultaneous loss of stable anchor points.

## 1.4 Architecture gate

Boundaries enforced by hard checks, not just docs.

- Local Commands:
  `python3 backend/rust_api/scripts/check_architecture.py`
- CI workflow：
  `.github/workflows/rust-api-architecture.yml`

Current minimum door access coverage:

- `AppState` Not allowed to reflow to `services/job_runner/ocr_provider` Mainnet
- `routes` Do not directly depend. `job_runner`
- `routes/jobs/*` Local variable redefinition disallowed. `route_deps(...)`
- artifact / download Boundary layer does not allow understanding to start. provider raw internal fields
- published markdown artifact Not allowed to re-download. `provider_raw_dir/full.md` or `provider_raw_dir/images` reverse-derive

If adjusting the whitelist later, update both the script and this document synchronously; do not update only one.

## 1.4 Artifact Boundary

Rust The boundary directly related to the side and product is fixed at four layers:

1. `provider raw`
2. `normalized`
3. `published artifact`
4. `download API`

Dependencies and responsibilities must remain one-way:

```text
provider raw -> normalized -> published artifact -> download API
```

Minimum definition per layer:

- `provider raw`
  provider Raw result snapshot: fidelity, rollback, debug only.normalize Input
- `normalized`
  OCR to translation/Unified Rendering Document Contract
- `published artifact`
  Rust Task File artifact key Registration, Discovery, and Export Layer
- `download API`
  Outermost HTTP Expose layer download

Rust Side key placement:

- [src/storage_paths.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/storage_paths.rs)
  facade; now split into `constants / job_paths / path_ops / resolvers / registry`
- [src/services/artifacts/mod.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/artifacts/mod.rs)
artifact facade; now split into `registry / bundle / response`
- [src/routes/download_response.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/routes/download_response.rs)
responsible for file download, markdown, preview, cover, thumbnail HTTP Response Output
- [src/routes/jobs/json_response](/home/wxyhgk/tmp/Code/backend/rust_api/src/routes/jobs/json_response)
responsible for jobs JSON query / debug / control / retry class HTTP response exit

Boundary rules:

- `storage_paths.rs` and `services/artifacts/*`
Process files only.artifact keystable resources, without parsing provider raw internal JSON structure
- `db.rs`
Now keep only. `Db` facade; row decode and schema Checks respectively pushed down to `src/db/rows.rs`, `src/db/schema.rs`
- `routes/jobs/download.rs`
  Only expose stable download entry; no commitment. provider Private field semantics
- `normalized-document` / `normalization-report`
belongs to normalized Boundary, not included provider raw
- `provider_result_json` / `provider_raw_dir`
belongs to provider raw Boundary: explicit only. artifact Download not unified document interface.
- published markdown materialize
  must retain provider Relative image path semantics; page-scope prefix may be added, but internal path patterns must not be fixedly rewritten to custom directory rules.

Quick judgment:

- If a change requires download-layer understanding. `layoutParsingResults`、`prunedResult` like that provider Field name, indicates boundary has been breached.
- If a change only adds artifact keyResource path adjustment. Stable download entry adjustment. Place in build script or deployment manifest. published artifact or download API layer

## 1.4 Published Markdown Artifact Boundary

This is a boundary recently tightened as a key focus:

- `provider_result_json`
- `provider_raw_dir`

belongs to provider raw.

- `ocr/normalized/document.v1.json`

belongs to normalize Unified contract thereafter.

- `md/full.md`
- `md/images/`
- `markdown_bundle_zip`

Already released. job artifact。

Rules:

1. `provider_raw_dir` can be retained provider Original response packets and debugging materials.
2. `provider_raw_dir` Cannot be treated as published markdown artifact Fallback source.
3. `resolve_markdown_path()` / `resolve_markdown_images_dir()` Resource resolution functions only parse external resources. `job_root/md/*` Published paths.
4. If a certain provider To be exposed later. MarkdownExplicitly add one. publish/materialize Steps, not download layer or storage path Guess Layer provider raw Layout.

Constraints?

- publish/materialize Can implement 'collision prevention packaging', e.g., append to image paths under multi-page tasks. `page-N/`
- markdown Internal image paths must point to the published directory. `md/images/`
- But must not rewrite provider Returned internal relative path structure
- For example when Paddle returns `<img src="imgs/foo.jpg">`, after publishing, can be `images/page-6/imgs/foo.jpg`
- Not our custom decision fixed pattern. `assets/foo.jpg` or other private repository naming

The reason is simple:

- provider raw Frequent changes
- published artifact External stable download metric.
- Two layers mixed together. Refactor: separate.`markdown_ready` will become distorted, and the download interface will also provider Private structure coupling

## 2. Module responsibilities

### 2.1 `app/`

Files:

- [src/app/mod.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/mod.rs)
- [src/app/state.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/state.rs)
- [src/app/router.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/router.rs)
- [src/app/server.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/server.rs)

Responsibilities:

- Assemble `AppState`
- Start HTTP server
- Mount Routes
- Restore legacy on startup running job

Unnecessary code delete.

- Business validation omitted.
- No input. job view
- No decision made. worker workflow

### 2.2 `routes/`

Contents:

- [src/routes](/home/wxyhgk/tmp/Code/backend/rust_api/src/routes)

Responsibilities:

- HTTP Request Parsing
- Header / Query / Multipart Extract
- Forward request to service
- Return Unified JSON / file response

What not to do:

- Do not access directly SQLite details
- Read it yourself. artifacts files
- Not your problem. Python Command

All routes are now consolidated to application facade：

- jobs → [src/services/jobs/facade.rs](src/services/jobs/facade.rs)
- library → [src/services/library_api.rs](src/services/library_api.rs)
- glossaries → [src/services/glossary_api.rs](src/services/glossary_api.rs)
- uploads → [src/services/upload_api.rs](src/services/upload_api.rs)

That is:

- `routes/jobs/*` Pass only response boundary call `JobsFacade`
- `routes/library.rs` / `library_data.rs` / `library_extras.rs` / `collections.rs`
  Adjust only `services/library_api.rs`(Classic `build_library_route_deps`）
- `routes/common.rs`
keep only route Side Public deps builder, base URL and unify HTTP envelope helper
- `routes/download_response/**`
  Keep only file response output.
- `routes/jobs/json_response/**`
keep only JSON response exit
- `routes/glossaries.rs`
only calls `services/glossary_api.rs`
- `routes/uploads.rs`
only calls `services/upload_api.rs`

**Library route File responsibilities (HTTP boundary, no business logic in route route）：**

| Route file | HTTP surface |
|------------|---------|
| `library.rs` | books List/Details/Deletebook cover/thumbnail |
| `library_data.rs` | documents CRUD/media/translate、favorites、search |
| `library_extras.rs` | assets、conversations |
| `collections.rs` | Collection CRUD and document members |

Quick judgment:

- Code review needed. Improve readability. HTTP Input parameters/Output params, check first `routes/*`
- To switch to use case orchestration, first see. application service
- To change provider / worker / stage Behavior, do not start from. route Start.

### 2.3 `services/` application entry

Directory:

- [src/services](src/services)

Responsibilities:

- to route Provide stable call entry.
- Orchestrates test cases and returns external-facing responses. view
- Block `db/config/data_root/storage` Pending resource assembly details.

Current finalized state. application Entry:

- [src/services/jobs/facade.rs](src/services/jobs/facade.rs)
- [src/services/library_api.rs](src/services/library_api.rs)
- [src/services/glossary_api.rs](src/services/glossary_api.rs)
- [src/services/upload_api.rs](src/services/upload_api.rs)

Rules:

- route Prioritize only these entry points.
- Do not let route Retry directly. `db + config + helper + artifact service`
- application service If internal grows, split first. facade Submodule or deps Substructure, do not revert to one main entry file plus one master. deps
- library domain DTO（`DocumentRecord`、favorites/search/collections etc.) via
`models::api` Re-export.route and migrated `db/*` **Forbidden** Direct connection `models::library`

#### `services/library_api` + `services/library/*`

Under modular monolith Library Domain (**not** Microservice decomposition:

```text
routes/library*.rs, collections.rs
  → library_api (view level API)
      → services/library/*
           books | documents | media | translate
           favorites | search | assets | conversations | collections
â JobsFacade   (only translate-from-library creates job)
â derived_artifacts (media only Internal use only. cover/thumbnail)
```

- [src/services/library_api.rs](src/services/library_api.rs)
  route the only permitted library service import
- [src/services/library/](src/services/library/)
  Internal implementation.`LibraryDeps` Hold `db + data_root + output_root + downloads_dir + scripts_dir + python_bin`
- Translate from Collection`library/translate.rs` Bind Document upload Then only call
  `JobsFacade::create_submission`Do not bypass. job Create Pipeline
- File streaming response still active. route：`stream_file` / download response；service /dev/null

### 2.4 `services/` Internal implementation in

Current key division of responsibilities:

- [src/services/job_snapshot_factory.rs](src/services/job_snapshot_factory.rs)
Responsible for job snapshot / command assembly
- [src/services/job_launcher.rs](src/services/job_launcher.rs)
Responsible for job Persistence and Startup Execution
- [src/services/runtime_gateway.rs](src/services/runtime_gateway.rs)
Responsible for services-side runtime Capability consolidation
- [src/services/jobs](src/services/jobs)
Responsible for jobs Related Business
- [src/services/library](src/services/library)
  Responsible for library domain business (see 2.3）
- [src/services/book_projection](src/services/book_projection)
Responsible for library books Projection (by `library/books` Call)
- [src/services/derived_artifacts](src/services/derived_artifacts)
Responsible for cover/thumbnail/page preview Pending derivative (by library media / jobs downloads called,**No**by route Direct connection)

Where `services/jobs` Split again into:

- `creation`
- `control`
- `query`
- `debug`
- `facade`
- `presentation`

#### `services/jobs/facade`

Files:

- [src/services/jobs/facade.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs/facade.rs)
- [src/services/jobs/facade/command](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs/facade/command)
- [src/services/jobs/facade/query](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs/facade/query)

Responsibilities:

- Provide unified entry point for routing layer.
- Hide `db/config/data_root` Low-level details pending.
- By use case continue splitting into smaller facade Submodules, not all entry points in one file.
- Separate command and query dependencies to avoid a single monolithic dependency. deps Drag simultaneously. create/query/debug/download Inflate together

Rules:

- New job Add routing capability first. facadethen by route call
- Need to create / Cancel class resources, prioritize placing into `CommandJobsDeps`
- Query required / Download / debug Class resources, prioritize placing into. `QueryJobsDeps`

#### `services/jobs/creation`

Directory:

- [src/services/jobs/creation](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs/creation)

Responsibilities:

- `submit.rs`
  Only responsible for creating and starting tasks after receiving input.
- `bundle.rs`
  Only: sync full chain, produce download. bundle”
- `job_builders.rs`
  Only responsible for parsing input into `JobSnapshot`
- `upload.rs`
Only responsible for PDF Upload persistence upload record reading
- `context.rs`
Only responsible for creation Side Display deps

Rules:

- Do not put "submit task" and "sync bundle" back into a single file.
- Don't include facade or route Reassemble inside upload Storage Details
- New creation use case First, determine which category it belongs to. `submit`ã`bundle`ã`job_builders` or `upload`

#### `services/jobs/presentation`

Directory:

- [src/services/jobs/presentation](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs/presentation)

Responsibilities:

- `views.rs`
Responsible for API view assembly
- `summary_loaders.rs`
  Responsible from manifest / report / summary File Read Summary
- `mod.rs`
Responsible for presentation External Boundary

Rules:

- Change JSON return structure, prefer to change `views.rs`
- When modifying summary fields supplemented from disk, prefer to change `summary_loaders.rs`
- Do not put file reading logic back into view Assemble function

### 2.5 `job_runner/`

Directory:

- [src/job_runner](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner)

Responsibilities:

- job Runtime Scheduling
- Python worker startup
- stdout/stderr parsing
- Cancellation, Timeout, Failure Attribution
- OCR child job / translate / render Execution path.

Current split:

- `lifecycle`
Queue tasks, acquire execution slot, press workflow dispatch
- `cancel_registry`
  Cancel Request Registry
- `execution_queue`
  Concurrent slot wait
- `worker_command`
stage command / stage spec / worker Unified factory for entry commands; this is `services` and `job_runner` Neutral Contract Layer for Common Dependencies
- `worker_process`
  Process startup, environment injection, process tree termination.
- `process_runner`
Real worker execution orchestrator
- `process_runner/completion.rs`
  cancel / success / shutdown noise / failed Completion status classification and backfill.
- `process_runner/timeout_support.rs`
  timeout Copy and timeout failure Normal
- `process_runner/failure_ai_diagnosis.rs`
Failed AI diagnosis request/response and event Record
- `process_runner/io_support.rs`
  stdout/stderr Consumption & cancel Stream reading strategy during the interval; only fetch again here. `JobPersistDeps + canceled_jobs`
- `runtime_state`
  Runtime snapshot Change
- `translation_flow`
translate / book related orchestratorOnly responsible for strings. OCR child -> translate -> optional render
- `translation_flow_child.rs`
upload source Read, Enter Parent Task `ocr_submitting`ãOCR child Construction and `ocr_child_created` event
- `translation_flow_stage.rs`
translate stage command preparation,`ocr_child_finished` Events,translate after render stage preparation
- `translation_flow_support.rs`
  OCR Final state determination,translate Input extraction: pure rule-based assistance.
- `render_flow`
  render-only Link
- `ocr_flow`
  OCR provider Execution path
- `ocr_flow/support.rs`
  OCR job Saveparent OCR Status Mirror,transport/source-pdf Failure handling`sync_parent_with_ocr_child(...)`
- `ocr_flow/workspace.rs`
Only responsible for OCR workspace path and directory preparation; now only takes `output_root`
- `ocr_flow/polling.rs`
  Only responsible for polling wait and cancel Check;`should_stop_polling(...)` Now only take. cancel handle
- `stdout_parser`
stdout parsing facade
- `stdout_parser/labels.rs` / `state.rs` / `stage_rules.rs` / `artifact_rules.rs` / `failure.rs`
  stdout Row label, shared parse state,stage/artifact/failure Rules

#### `worker_command`

Directory:

- [src/worker_command](/home/wxyhgk/tmp/Code/backend/rust_api/src/worker_command)

Responsibilities:

- `stage_specs.rs`
Writes spec files for `provider/normalize/translate/render`
- `entrypoints.rs`
  select Python Script entry: assemble entry parameters.
- `command_builder.rs`
  Command-line build details only.
- [src/worker_command.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/worker_command.rs)
  Keep external only `build_*` facade

Rules:

- Change spec Field, Edit `stage_specs.rs`
- Change worker Entry script, modify. `entrypoints.rs`
- Do not Rewrite layer JSON in facade

#### `job_runner/process_runner`

Files:

- [src/job_runner/process_runner.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner.rs)
- [src/job_runner/process_runner/startup.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/startup.rs)
- [src/job_runner/process_runner/execution.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/execution.rs)
- [src/job_runner/process_runner/completion.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/completion.rs)
- [src/job_runner/process_runner/timeout_support.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/timeout_support.rs)
- [src/job_runner/process_runner/failure_ai_diagnosis.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/failure_ai_diagnosis.rs)
- [src/job_runner/process_runner/io_support.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/process_runner/io_support.rs)

Responsibilities:

- `process_runner.rs`
Only keep worker execution orchestrator
- `startup.rs`
  Owns worker startup: starts the process, persists the PID, and short-circuits cancellation that arrives during startup. Only takes `JobPersistDeps + canceled_jobs + WorkerProcessRuntimeConfig`.
- `execution.rs`
  Handles stdout/stderr reading, waits for the task process to exit on signal, and routes to the timeout fallback. Only takes `JobPersistDeps + canceled_jobs + WorkerProcessRuntimeConfig`.
- `completion.rs`
  Handles the final-state classification: success determination, failure backfill, and filtering out shutdown noise. Timeout handling lives elsewhere.
- `timeout_support.rs`
  Owns the timeout-failure fallback state. Only takes `JobPersistDeps + project_root`.
- `failure_ai_diagnosis.rs`
  Handles AI-assisted failure diagnosis.
- `io_support.rs`
Handles stdout/stderr Consumption and cancel Special case; leaf helper Discard entire package. `ProcessRuntimeDeps`

Rules:

- Don't write new command build logic here.
- Unregister table not maintained here.
- Do not decide execution slot policy here.
- `execute_process_job(...)`
  Keep entire package. `ProcessRuntimeDeps`but pass down to leaf helper Must be converted before. `persist`、cancel handle or narrow config projection
- `spawn_worker_process(...)` / `spawn_started_process(...)` / `collect_process_execution(...)` / `read_stdout(...)`
  These leaves helper Take only what you truly need. config / persist / cancel Dependencies

#### `job_runner` Stop Line

The final round of decoupling should stop here:

- orchestrator Continue taking at level entrance. `ProcessRuntimeDeps`
- Leaf helper Change to Take `JobPersistDeps`ã`&Db`Narrow config projection or cancel handle
- Stop. orchestrator further split into more small functions across files
- Stop sending data unnecessarily. 1-2 Add field. Confirm necessity. trait / wrapper / facade

#### `job_runner/translation_flow_*`

Files:

- [src/job_runner/translation_flow.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/translation_flow.rs)
- [src/job_runner/translation_flow_child.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/translation_flow_child.rs)
- [src/job_runner/translation_flow_stage.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/translation_flow_stage.rs)
- [src/job_runner/translation_flow_support.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/translation_flow_support.rs)

Responsibilities:

- `translation_flow.rs`
Keep only the parent translation job orchestrator.
- `translation_flow_child.rs`
Handles upload source read, parent enter `ocr_submitting`, OCR child job create, and `ocr_child_created` events.
- `translation_flow_stage.rs`
Handles OCR child end event, translate stage command preparation, and render stage prepare after translation.
- `translation_flow_support.rs`
Handles `finalize_parent_after_ocr(...)`, `translation_inputs_from_artifacts(...)` pure rule assistance.

Rules:

- Do not duplicate heap inside orchestrator. OCR child construction details.
- Do not select persistence entry point within support helper.
- Consolidate translate/render command rewrites in stage helper.

#### `job_runner/ocr_flow/*`

Files:

- [src/job_runner/ocr_flow/mod.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/ocr_flow/mod.rs)
- [src/job_runner/ocr_flow/support.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/ocr_flow/support.rs)
- And `transport / polling / mineru / paddle / artifacts / provider_result / workspace / markdown_bundle / bundle_download / status / page_subset / mineru_retry / mineru_polling / paddle_markdown`

Responsibilities:

- `ocr_flow/mod.rs`
Keep only the OCR orchestrator: string transport -> normalize -> process runner.
- `ocr_flow/support.rs`
Handles OCR job saving, parent OCR status mirroring, transport/source-pdf failure handling, `sync_parent_with_ocr_child(...)`.
- Other subfiles
  Process separately. provider transportPoll. Download.raw Result placement,markdown materialize、workspace and status backfill.

#### `job_runner/stdout_parser/*`

Files:

- [src/job_runner/stdout_parser/mod.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/stdout_parser/mod.rs)
- [src/job_runner/stdout_parser/labels.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/stdout_parser/labels.rs)
- [src/job_runner/stdout_parser/state.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/stdout_parser/state.rs)
- [src/job_runner/stdout_parser/stage_rules.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/stdout_parser/stage_rules.rs)
- [src/job_runner/stdout_parser/artifact_rules.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/stdout_parser/artifact_rules.rs)
- [src/job_runner/stdout_parser/failure.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner/stdout_parser/failure.rs)

Responsibilities:

- `mod.rs`
  facadecall per line artifact/stage rules.
- `labels.rs`
  stdout contract Label constants.
- `state.rs`
  artifact/provider diagnostics Shared parsing state.
- `stage_rules.rs`
  stage/progress Related rules.
- `artifact_rules.rs`
Rules related to artifact/metric.
- `failure.rs`
  provider failure Attribution and detail extraction.

### 2.5 `ocr_provider/`

Directory:

- [src/ocr_provider](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider)

Responsibilities:

- Provider transport Abstraction
- MinerU / Paddle Client, state mapping, error classification

Rules:

- Handle only here. provider Communication and provider Semantics
- No handling translation renderHTTP Response structure

## 3. Current main call chain

Mainnet

1. `POST /api/v1/jobs`
2. `routes/jobs/create.rs`
3. `services/jobs/facade.rs`
4. `services/jobs/creation.rs`
5. `services/job_snapshot_factory.rs`
6. `services/job_launcher.rs`
7. `job_runner/lifecycle.rs`
8. `worker_command.rs`
9. `job_runner/process_runner.rs`
10. Python worker

That is:

- route Input only facade
- facade only calls service
- service only calls runner

## 4. Team collaboration red lines

Hard constraints:

### Red line 1

`routes/*` Don't read directly:

- `Db`
- `job_paths`
- manifest/report JSON files
- Python worker Command Details

### Red line 2

`job_runner/*` No dependencies:

- `axum`
- `HeaderMap`
- HTTP response model

### Red line 3

`ocr_provider/*` Do not:

- job view assembly
- Translation Strategy
- Rendering Strategy

### Red line 4

If a change involves both:

- route
- service
- runner

Pause. Check boundary placement.

### Red line 5

Add file read summary logic, place first:

- `services/jobs/presentation/summary_loaders.rs`

Do not scatter

- route
- facade
- `views.rs`

## 5. Change Guide

### Scenario 1Add a new jobs Query API

Change order:

1. `routes/jobs/*`
2. `services/jobs/facade.rs`
3. `services/jobs/query.rs` or `presentation/*`

Don't translate from route Step over facade access the underlying layers.

### Scenario 2: Add a worker stage spec field

Change order:

1. `worker_command/stage_specs.rs`
2. Python `stage_specs` loader
3. Corresponding worker Consumption Logic

Do not add temporary parameters to layer in route/service.

### Scenario 3: Add a provider

Change order:

1. `ocr_provider/<provider>/`
2. `job_runner/ocr_flow/*`
3. Python provider pipeline

Don't scatter provider determination across route or facade.

### Scenario 4: Adjust job detail return fields

Change order:

1. `services/jobs/presentation/views.rs`
2. If field from disk summary, modify again. `summary_loaders.rs`

## 6. Current recommendation

If further refactoring, priority suggestions:

1. Give `services/jobs` clearer request/response DTO boundaries
2. Give `job_runner` stage execution contract documentation
3. Unify trait / capability contract for `ocr_provider`

Current version already supports parallel development, provided the above dependency directions and red lines are adhered to.

Relevant supplementary documentation:

- [`STAGE_EXECUTION_CONTRACT.md`](/home/wxyhgk/tmp/Code/backend/rust_api/STAGE_EXECUTION_CONTRACT.md)
- [`OCR_PROVIDER_CONTRACT.md`](/home/wxyhgk/tmp/Code/backend/rust_api/OCR_PROVIDER_CONTRACT.md)
