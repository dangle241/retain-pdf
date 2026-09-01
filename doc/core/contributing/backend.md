# Rust API contribution guide

## Layering direction

Default dependency direction:

```text
routes -> services -> job_snapshot_factory / job_launcher / runtime_gateway / db
job_runner -> db / config / runtime state
models do not reverse-depend on routes or services
```

Basic rules:

- routes/* only do HTTP adapter: request parsing, auth check, entry point, response wrapper.
- `services/jobs/*` Place task-domain business logic, including query、presentation、creation、control。
- `job_runner/*` Runtime execution, process startup, cancellation.OCR Subtask handoff and phase progression.
- `models/*` Place only DTOInput/output and persistence models exclude business orchestration and filesystem reads.
- Do not cut corners: AppState should only need to pass Db, AppConfig, Path, or semaphore helpers.

See more detailed rules in Rust API collaboration conventions.

## API Changes

- Add Public API When using fields, use stable. view/model, do not expose internal `JobSnapshot` Expose fields directly.
- When adding or modifying interfaces, events, artifacts, manifest, reader metadata, diagnostics, resume actions, update API documentation or corresponding rust_api docs.
- API Return fields preferentially from view/projection Layer output, do not route Temporary patch. JSON。
- Download previewRange、ETag、reader regions Frontend-critical APIs must keep fields stable and backward-compatible.

## Common checks

```bash
cargo fmt --manifest-path backend/rust_api/Cargo.toml --check
cargo test --manifest-path backend/rust_api/Cargo.toml
cd backend/rust_api && python3 scripts/check_architecture.py
```

## PR description

PRs involving Rust API should at least specify:

- Which are affected? endpoint or internal service。
- whether it changes job、artifact、reader、library、resume、diagnostics Wait for the contract.
- Whether it affects frontend, desktop, or API documentation.
- What has been run? Rust checks; if not run, explain why.
