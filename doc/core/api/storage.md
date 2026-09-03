# Storage structure

Runtime root directory determined by `RUST_API_DATA_ROOT` Decision; use below. `DATA_ROOT` Refers to this parsed directory.

## Main path

- `DATA_ROOT/uploads/`Upload file.
- `DATA_ROOT/jobs/{job_id}/`Task working directory.
- `DATA_ROOT/downloads/`Download cache.
- `DATA_ROOT/db/jobs.db`：SQLite Database.

## Task directory

Standard Task Directory

```text
jobs/{job_id}/
├── source/
├── ocr/
├── translated/
├── rendered/
├── artifacts/
└── logs/
```

Common artifacts:

- `ocr/`：Provider Original result, unpacked result, standardized input.
- `translated/`Intermediate products and `translation-manifest.json`。
- `rendered/`Render Output.
- `artifacts/`Stable release artifacts, diagnostic files, and indices.
- `logs/pipeline_events.jsonl`Main file for current event persistence.

Backward compatibility:

- Old tasks may only have `logs/events.jsonl`。
- Current read logic reads first. `pipeline_events.jsonl`then revert to the old filename.

## SQLite

SQLite Main responsibility:

- `uploads`Source file name, storage path,PDF Size, page count, upload time.
- `jobs`Task Status, Phase, Progress, Request/runtime Status, failure info, and log tail.
- `artifacts`of each task artifact index JSON。
- `job_artifact_entries`Normalize artifact manifestfor download and list display.
- `events`Structured event stream.
- `glossaries`Name glossary resource.

Use relative paths in API responses and database records. Resolve to actual files at runtime to avoid exposing machine paths to the frontend.

## Boundary conventions

- Rust Assigns task directories and registers. artifacts。
- Python workers only consume paths passed by Rust.
- Frontend and external callers should not depend on the internal layout of the task directory.
- Formal artifact discovery entry is `GET /api/v1/jobs/{job_id}/artifacts-manifest`。
