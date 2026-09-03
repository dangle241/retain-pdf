# Rust API Docs

This index answers only one question:

**View now `rust_api` Start with README.md. It provides the project overview, setup instructions, and quick start guide.**

## Recommended reading order

1. External HTTP API for frontend integration:
   [`../doc/core/api/index.md`](../../doc/core/api/index.md)
2. How exactly does the current system run:
   [`CURRENT_API_MAP.md`](CURRENT_API_MAP.md)
3. First check the directory, know where to modify:
   [`RUST_API_DIRECTORY_MAP.md`](RUST_API_DIRECTORY_MAP.md)
4. Team Collaboration Boundaries and Layering Rules:
   [`RUST_API_ARCHITECTURE.md`](RUST_API_ARCHITECTURE.md)
5. Rust side artifact 4-layer boundary:
[`10-Rust ä¾§ Artifact Boundary.md`](../../doc/core/rust_api/10-Rust%20%E4%BE%A7%20Artifact%20Boundary.md)
6. Rust and Python stage spec contract:
   [`STAGE_EXECUTION_CONTRACT.md`](STAGE_EXECUTION_CONTRACT.md)
7. Phase events and failure protocol:
   [`../doc/core/rust_api/11-Phase Events and Failure Protocol.md`](../../doc/core/rust_api/11-%E9%98%B6%E6%AE%B5%E4%BA%8B%E4%BB%B6%E4%B8%8E%E5%A4%B1%E8%B4%A5%E5%8D%8F%E8%AE%AE.md)
8. job_runner Runtime boundary:
   [`../doc/core/rust_api/12-job_runner Boundary.md`](../../doc/core/rust_api/12-job_runner%20%E8%BE%B9%E7%95%8C.md)
9. OCR provider boundary:
   [`OCR_PROVIDER_CONTRACT.md`](OCR_PROVIDER_CONTRACT.md)
10. Paddle OCR asynchronous API summary:
   [`src/ocr_provider/paddle/API_SUMMARY.md`](src/ocr_provider/paddle/API_SUMMARY.md)
11. Paddle Markdown / artifact boundary:
   [`../doc/core/paddle_ocr_api/06_job_artifact_boundary.md`](../../doc/core/paddle_ocr_api/06_job_artifact_boundary.md)

## What problem each doc solves

- [`CURRENT_API_MAP.md`](CURRENT_API_MAP.md)
Focus only on the currently running main chain. Emphasize: after the request enters, how exactly do Rust and Python connect?
- [`RUST_API_DIRECTORY_MAP.md`](RUST_API_DIRECTORY_MAP.md)
  Focus on current directory responsibilities; primarily answer "which directory to enter first to modify code."
- [`RUST_API_ARCHITECTURE.md`](RUST_API_ARCHITECTURE.md)
  Focus only on current team collaboration boundaries. Answer: where to change correctly, which layers must not be breached.
- [`10-Rust ä¾§ Artifact Boundary.md`](../../doc/core/rust_api/10-Rust%20%E4%BE%A7%20Artifact%20Boundary.md)
Only look at the Rust-side artifact boundary, focus on answering "provider raw / normalized / published artifact / download API â what does each of the four layers handle?"
- [`../doc/core/api/index.md`](../../doc/core/api/index.md)
Only look at external HTTP behavior. Focus: API call method, return values, formal contract fields.
- [`API_SPEC.md`](API_SPEC.md)
  Retained as historical and implementation reference; no longer the primary frontend document.
- [`STAGE_EXECUTION_CONTRACT.md`](STAGE_EXECUTION_CONTRACT.md)
Only look at the stage worker spec protocol, focusing on answering "how does Rust pass execution input to Python"
- [`../doc/core/rust_api/11-é¶æ®µäºä»¶ä¸å¤±è´¥åè®®.md`](../../doc/core/rust_api/11-%E9%98%B6%E6%AE%B5%E4%BA%8B%E4%BB%B6%E4%B8%8E%E5%A4%B1%E8%B4%A5%E5%8D%8F%E8%AE%AE.md)
Only status/events/failure formal agreement. Focus on answering: how does Python emit events? How does Rust canonicalize them? Frontend consumes: `id`, `name`, `status`, `createdAt`, `updatedAt`.
- [`../doc/core/rust_api/12-job_runner è¾¹ç.md`](../../doc/core/rust_api/12-job_runner%20%E8%BE%B9%E7%95%8C.md)
  Focus on runtime execution layer boundaries; specifically answer "which module should contain the logic when modifying job_runner". job_runner Which module should the time logic be placed in?
- [`OCR_PROVIDER_CONTRACT.md`](OCR_PROVIDER_CONTRACT.md)
Only look at the provider adapter boundary, focus on answering "at which layer do MinerU / Paddle distribute and converge?"
- [`src/ocr_provider/paddle/API_SUMMARY.md`](src/ocr_provider/paddle/API_SUMMARY.md)
Only look at the Paddle OCR asynchronous interface protocol, key answers: how exactly do submit / poll / result download get there?
- [`../doc/core/paddle_ocr_api/06_job_artifact_boundary.md`](../../doc/core/paddle_ocr_api/06_job_artifact_boundary.md)
Only look at the Markdown release boundary, key answer: provider raw cannot be used directly. Requires root job markdown artifact.

## Current recommended cognitive path

- To quickly understand the system:
  `README -> RUST_API_DIRECTORY_MAP -> CURRENT_API_MAP -> RUST_API_ARCHITECTURE`
- Want to change backend code:
`RUST_API_DIRECTORY_MAP -> RUST_API_ARCHITECTURE -> 10-Rust ä¾§ Artifact Boundary -> CURRENT_API_MAP -> Corresponding source code`
- Connect to frontend or third-party:
  `doc/core/api/index.md -> CURRENT_API_MAP`

## Architecture gatekeeper

Backend changes: at least run these by default:

- `python3 backend/rust_api/scripts/check_architecture.py`
- `cargo build --manifest-path backend/rust_api/Cargo.toml`
- `cargo test --manifest-path backend/rust_api/Cargo.toml --lib job_runner::process_runner::tests::execute_process_job_injects_provider_and_translation_envs`
- `cargo test --manifest-path backend/rust_api/Cargo.toml --lib routes::jobs::query::tests::job_detail_and_events_routes_redact_secrets`

First: block the most regression-prone architectural issues.

- `AppState` Fall back to `services/job_runner/ocr_provider`
- `routes` Direct dependency `job_runner`
- `routes/jobs/*` manually rewrite local `route_deps(...)`
- `routes` directly use `state.db` / `state.config` or bypass the facade to import internal services
- library / glossary / upload route Unverified `*_api` Entry
- `ProcessRuntimeDeps::new(...)` is casually assembled outside the boundary layer in `app`.
- `JobPersistDeps` overflows again from the leaf helper boundary.
- `runtime_deps` Structs redistributed back across multiples. runner File
- `state.rs` re- stale running job recovery Mixed Return bootstrap
- `lifecycle.rs` re-degrades into a large function, discarding the already consolidated helper boundary
- artifact/download Restart boundary layer understanding. provider raw internal fields
- published markdown artifact re-start from `provider_raw_dir/full.md|images` Reverse Inference
