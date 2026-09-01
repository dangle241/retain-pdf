# Database and Persistence Contribution Guidelines

## Runtime Location

当前 Rust API 使用 SQLitedefault location is `DATA_ROOT/db/jobs.db`Local dev paths: `src/` edit → `npm run dev` → `http://localhost:3000`

- `data/db/jobs.db`：SQLite Database, default no commit.
- `data/jobs/**`Job execution directory and intermediate artifacts, not committed by default.
- `data/uploads/**`Uploaded files, not committed by default.
- `data/downloads/**`Downloaded artifacts, not submitted by default.

See storage structure in Runtime storage structure.

## Code boundary

Database access centralized at `backend/rust_api/src/db.rs` and its submodules:

- `src/db.rs`：`Db` facadeExternally available job、artifact、event、glossary Wait for persistence capability.
- `src/db/schema.rs`Create table.schema Check and compatibility initialization.
- `src/db/rows.rs`Database row to internal model decode。

Basic rules:

- When involving the database, prioritize through Db facade and existing row/schema modules; do not write SQL directly in route or presentation layers.
- When adding a persistent field, first determine whether it belongs to a database record or a file. manifestor runtime temporary state; do not casually put temporary state into the database.
- Store relative paths in DB whenever possible (artifact key, job_id, and stable metadata); actual file paths resolved at runtime by storage path resolver.
- API return fields should prioritize output from view/projection layers; do not let frontend directly depend on database column names or JobSnapshot internal fields.
- Glossary, library, artifact manifest, reader metadata should prioritize stable table design for long-term frontend data/stable views.

## Compatibility requirements

When changing schema, consider:

- Can old jobs.db start up?
- Can old job lists, details, deletions work?
- Can old artifacts be downloaded?
- Can old glossaries still be read or migrated?
- Affects re-rendering, breakpoint recovery, or failure diagnosis?

Do not commit locally. `data/db/jobs.db`Reproduce issue. Use smallest dataset possible. SQLDesensitize data fixture、job_id、schema Version and reproduction steps.

## Common checks

```bash
cargo test --manifest-path backend/rust_api/Cargo.toml
cd backend/rust_api && python3 scripts/check_architecture.py
```

When adding new database behavior, prioritize supplementing. `backend/rust_api/src/db.rs` or related service Minimum unit test.

## PR description

Database-related PRs should at least state:

- Which tables, columns, indexes, or JSON fields were added or modified.
- Compatibility with old jobs, old artifacts, old glossaries.
- Migration, backfill, cleanup, or one‑time repair scripts needed?
- Which databases tested. Old sample data validated?
