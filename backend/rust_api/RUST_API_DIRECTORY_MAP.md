# Rust API Directory Map

This document answers only one question:

**Change required now. `rust_api`cd /**

## Most common entry point

- Change HTTP API:
  [`src/routes`](src/routes)
- Change jobs use case orchestration:
  [`src/services/jobs`](src/services/jobs)
- Change library domain (document/Favorite/Search/Assets/Session/Collection):
  [`src/services/library_api.rs`](src/services/library_api.rs) +
  [`src/services/library`](src/services/library)
- Change worker execution path:
  [`src/job_runner`](src/job_runner)
- Change OCR provider distribution and adaptation:
  [`src/ocr_provider`](src/ocr_provider)
- Modify backend runtime parameters: provider timeout/retry, path, and authentication configuration:
  [`src/config`](src/config)
- Change Python worker entry command or stage spec:
  [`src/worker_command`](src/worker_command)

## Directory map

### `src/app`

- Purpose:
  Application startup,`AppState` Assemble,router Mount, start service.
- Entry conditions:
  Only enter here when modifying global resources, startup logic, or route mounting.
- Key files:
  - [`src/app/state.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/state.rs)
    `AppState` Global resource initialization.
  - [`src/app/router.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/router.rs)
    axum Route root mount point.
  - [`src/app/jobs.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/jobs.rs)
    jobs facade Composition root. Responsible for `AppState` Pretend `JobsFacade`，`routes` No longer touch directly `job_runner`。

### `src/config.rs` + `src/config/*`

- Purpose:
Runtime configuration entry point. `config.rs` is a compatibility facade continuing to expose the original `AppConfig` fields; `src/config/*` is the actual configuration group.
- Entry condition:
Change env/deployment parameters: provider timeout/retry, path, auth, upload limit 10 MB, worker running parameters. Enter here.
- Current sub-boundary:
  - `config.rs`
    `AppConfig` Compatibility layer;`from_env()` / `from_desktop()` Only parse source; consistently use internal. `AppConfigParts` assemble. Do not continue to pile specific env parse.
  - `config/env_vars.rs`
env reading helper: handles empty strings and positive integers uniformly, with fallback.
  - `config/paths.rs`
project root, rust_api root, data root, scripts, jobs/uploads/downloads paths and runtime directory creation.
  - `config/auth.rs`
    `auth.local.json`、`RUST_API_KEYS`、`RUST_API_MAX_RUNNING_JOBS`、`RUST_API_SIMPLE_PORT`。
  - `config/server.rs`
    `PYTHON_BIN`、`RUST_API_BIND_HOST`、`RUST_API_PORT`。
  - `config/upload.rs`
    `RUST_API_UPLOAD_MAX_BYTES`、`RUST_API_UPLOAD_MAX_PAGES`。
  - `config/provider.rs`
MinerU / Paddle / DeepSeek base URL, HTTP timeout, retry, provider upload threshold settings. Paddle input image limit.
  - `config/job_runner.rs`
queue polling, worker termination grace, AI failure diagnosis timeout, sync bundle wait interval.
- Rule:
  When adding new deployment-tunable parameters, prioritize the above submodule; only if existing caller compatibility must be preserved, then in `AppConfig` Expose fields.
  stage Nameartifact key、API path、schema version、stdout label Such protocol constants should not be made configurable.

### `src/routes`

- Purpose:
  HTTP Parameter extraction, request forwarding, unified response wrapping.
- What not to do:
Do not touch `job_runner` directly, do not assemble low-level business logic yourself, do not access `state.db` / internal service.
  models Only via `models::api` / `domain` / `request`。

#### `src/routes/jobs`

- `json_response/`
jobs JSON query / detail / cancel / retry: only call the response outlet `JobsFacade`.
  and encapsulate `ApiResponse`。
- `create.rs` / `download.rs` / `query.rs` / `control.rs` / `translation_debug.rs`
  True axum route Entry.

#### `src/routes` library surface

- `library.rs`
  books Projection APIAdjust only. `library_api`；cover/thumbnail go `download_response`。
- `library_data.rs`
documents / media / translate-from-library / favorites / search; only call `library_api`.
- `library_extras.rs`
  assets / conversations；multipart Extract and Keep routeBusiness proceed `library_api`。
- `collections.rs`
collection CRUD and member relationships; only calls `library_api`.
- deps：`routes/common.rs::build_library_route_deps`（`LibraryDeps` + `JobsFacade`）。

#### `src/routes/download_response`

- Purpose:
  File Downloadmarkdown、preview、cover、thumbnail Export response.
- User:
`routes/jobs/*` and `routes/library.rs` can both call it; route modules must not reuse private members across boundaries. helper.

### `src/services`

- Purpose:
  application service Entry and internal business implementation.

#### `src/services/jobs/facade`

- Purpose:
Provide route with a unified jobs entry point.
- `command/*`
  Create, Cancel, Sync bundle Such imperative capabilities.
- `query/*`
  List, Details, Download,artifacts、translation debug Query capabilities.

#### `src/services/library_api.rs` + `src/services/library/*`

- Purpose:
  Provide route Provide unified **Library** Entry (with `JobsFacade` / `glossary_api` Same level).
- Entry condition:
  Enter here for changes to documents, holdings translation entry, favorites, full-text search, assets, sessions, and collections.
  **Don't** Revert logic. `routes/library_*`。
- Submodule:
- `books.rs` â library books list/detail/delete (projection delegation to `book_projection`)
- `documents.rs` / `media.rs` â document CRUD and source.pdf/cover/thumbnail
- `translate.rs` â bound document upload based on `JobsFacade::create_submission`
  - `favorites.rs` / `search.rs` — Anchor Favorites and blocks FTS
  - `assets.rs` / `conversations.rs` / `collections.rs` — Assets, Sessions, Collections
- Rule:
route only imports `library_api::`; `derived_artifacts` only allowed for internal service use.

#### `src/services/jobs/creation`

- `submit.rs`
  Create and start task.
- `bundle.rs`
  Run full end-to-end sync and produce output. bundle。
- `prepare.rs`
  Input parsing missing. Add: `if (!input) return error("Input required.");` `Prepared*` input, no generation `JobSnapshot`。
- `job_builders.rs`
  workflow Level snapshot orchestration; consume only `Prepared*` input and call snapshot factoryRemove pre-validation. Let downstream handle it.
- `upload.rs`
  upload Persistence and upload record Read.
- `context.rs`
explicit deps on the creation side.

#### `src/services/jobs/presentation`

- Purpose:
external view assembly, summary read, response projection.
- Entry condition:
Change API return structure, summary fields, desensitized display: go here.

#### Other service entries

- [`src/services/upload_api.rs`](src/services/upload_api.rs)
  Upload endpoint.
- [`src/services/glossary_api.rs`](src/services/glossary_api.rs)
  Glossary API endpoint.
- [`src/services/library_api.rs`](src/services/library_api.rs)
  Library API entry point (see above).
- [`src/services/job_snapshot_factory.rs`](src/services/job_snapshot_factory.rs)
  job snapshot/command Construct boundaries.
- [`src/services/job_launcher.rs`](src/services/job_launcher.rs)
  job Persistence and startup boundary.
- [`src/services/runtime_gateway.rs`](src/services/runtime_gateway.rs)
  services Access runtime Capability consolidation layer.

### `src/worker_command.rs` + `src/worker_command/*`

- Purpose:
  Python worker Commands,worker Entry script and stage spec File structure.
- Entry condition:
Changes to `normalize/translate/render/provider` spec fields, Python entrypoint command-line arguments go here.
- Boundaries:
This is a neutral contract layer for shared dependencies between `services` and `job_runner`; it is not part of `services`. Avoid `job_runner -> services` reverse dependencies.
- Current sub-boundaries:
  - `worker_command.rs`
External facade: `build_ocr_command` / `build_translate_only_command` / `build_render_only_command` / `build_normalize_ocr_command`.
  - `worker_command/stage_specs.rs`
Writes stage spec JSON.
  - `worker_command/entrypoints.rs`
Select Python script entry point and concatenate entry parameters.
  - `worker_command/command_builder.rs`
    Command-line assembly details.

### `src/job_runner`

- Purpose:
Task queue, worker startup, stdout/stderr consumption, failure attribution, cancellation, timeout.
- Quick judgment:
Changes to stage execution order, concurrency slots, process control, runtime sync go here.
- Detailed boundaries:
[`doc/core/rust_api/12-job_runner boundaries.md`](/home/wxyhgk/tmp/Code/doc/core/rust_api/12-job_runner%20%E8%BE%B9%E7%95%8C.md)
- Current directory map:
  - `mod.rs`
    runner facadepublic depsExport external `ProcessRuntimeDeps` Only for orchestrator Use,`JobPersistDeps` Leaf. helper Persistent resource boundary.
  - `lifecycle.rs`
    Task queue, execution slot,workflow Distribute.
  - `process_runner.rs` + `process_runner/*`
Real worker actuator; `process_runner.rs` keeps only the orchestrator and passes `ProcessRuntimeDeps` narrow accessors to download dependencies. `startup.rs` handles worker startup and pid persistence, `execution.rs` handles process waiting and timeout traffic splitting, `completion.rs` handles completed state classification and shutdown-noise determination, `timeout_support.rs` handles timeout state persistence, `failure_ai_diagnosis.rs` handles failure AI diagnosis, `io_support.rs` handles stdout/stderr consumption. Leaf helpers take only `JobPersistDeps`, cancel handle, or `WorkerProcessRuntimeConfig` â these narrow dependencies.
  - `translation_flow.rs` + `translation_flow_*.rs`
OCR subsequent translation/render parent task orchestration. `translation_flow.rs` retains the orchestrator, `translation_flow_child.rs` handles upload source reading, parent task entering `ocr_submitting`, and OCR child creation; `translation_flow_stage.rs` handles translate/render stage preparation and the `ocr_child_finished` event; `translation_flow_support.rs` handles OCR final state determination and translation input extraction.
  - `ocr_flow/*`
OCR child job execution chain: provider polling/download/markdown materialization. Among these, `ocr_flow/mod.rs` is the orchestrator; `ocr_flow/support.rs` handles OCR job saving, parent OCR state mirroring, transport/source-pdf error handling, and `sync_parent_with_ocr_child(...)`; `workspace.rs` contains only paths and directories; `polling.rs` just polls, waits, and checks cancellation.
  - `stdout_parser/*`
stdout line-level rule parsing; `mod.rs` is the facade, `labels.rs` manages stdout tag constants, `state.rs` state management needed. Redux too heavy. Use Context API. â skipped: Redux, add when scaling needed. `stage_rules.rs` / `artifact_rules.rs` manage line-level rules, `failure.rs` manages provider failure attribution.
  - `runtime_state.rs`
    runtime snapshot / failure / artifact Unified update tool.
  - `worker_process.rs`
    Subprocess started.env Injection, process tree termination; now only fetch. `WorkerProcessRuntimeConfig + job`No longer depends on the full package. runtime deps。

### `src/ocr_provider`

- Purpose:
  OCR provider Distribute,provider Specific protocol conversion,provider Finalize Output.
- Quick check:
Change MinerU / Paddle. For integration details, go here.

### `src/storage_paths.rs` + `src/storage_paths/*`

- Purpose:
  artifact keyPath normalization resolve redundant segments `.` `..` case differences. Use `path` module `normalize()`. `path.resolve()` for absolute paths.  ponytail: preserve trailing slashes if required, switch to `path.posix` for cross-platform.artifact registry Collect.
- Current sub-boundary:
  - `constants.rs`
    artifact key / group / kind Constants.
  - `job_paths.rs`
    `JobPaths` And task directory creation.
  - `path_ops.rs`
    Normalize relative paths, unify storage.legacy Judge.
  - `resolvers.rs`
    All Categories published artifact Path resolution.
  - `registry.rs`
Project task file to artifact entry list.

### `src/db.rs` + `src/db/*`

- Purpose:
  SQLite Persistence entry.
- Current sub-boundaries:
  - `rows.rs`
    SQLite row -> Domain model decoding.
  - `schema.rs`
    schema Check and enable startup migration protection.
  - `db.rs`
Main `Db` facade and specific read/write use cases.

## Three quick checks

- This HTTP Behavior change?
  Check first `src/routes`
- Is this jobs? Does the use case orchestration change?
Look first at `src/services/jobs/facade` and `src/services/jobs/creation`
- Is this worker / Python? Apply changes?
Look first at `src/job_runner`

## More intuitive directory map

Current recommendation: understand backend along this line:

1. `src/routes`
   HTTP Adapter layer: parameter extraction and response encapsulation only.
2. `src/services/jobs/facade`
   jobs Use case main entryroute Only sum facade speak.
3. `src/services/jobs/creation` / `src/services/jobs/presentation`
   The former handles creation and submission; the latter handles detail/list/events External projection.
4. `src/job_runner`
   Runtime orchestration, child processes,OCR flow、translation/render flow。
5. `src/ocr_provider`
   provider Protocol and provider Output normalization.

New starters: to quickly locate modification entry points, ask: which layer are you changing?

- HTTP adapter
- Use Case Orchestration
- Show Projection
- Runtime execution
- provider Protocol

Then cd to matching dir; don't cross from start. `routes -> services -> job_runner` Modify multiple layers simultaneously.

## Newcomer reading order

First time with this backend? Suggested reading order:

1. [`src/app/router.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/router.rs)
First, know what's available. HTTP entry point.
2. [`src/app/jobs.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/app/jobs.rs)
   Then check jobs How were the relevant dependencies installed?
3. [`src/routes/jobs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/routes/jobs)
   look route How to forward?
4. [`src/services/jobs/facade`](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs/facade)
View command/query use case entry.
5. [`src/services/jobs/creation`](/home/wxyhgk/tmp/Code/backend/rust_api/src/services/jobs/creation)
   View preparation, snapshot, commit of create link.bundle。
6. [`src/job_runner`](/home/wxyhgk/tmp/Code/backend/rust_api/src/job_runner)
   Finally, enter again. runtime Execution layer.
