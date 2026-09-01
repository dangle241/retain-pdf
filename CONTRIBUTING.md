# Contribution Guide

Thanks for participating. RetainPDFProject contains Rust APIDatabase.Python OCR/Translation/Rendering pipeline, static frontend, desktop, and Docker Deliver. Contributions: clear boundaries, verifiable changes, reproducible issues.

## Contribution Areas

- Frontend and Desktop: Task Status, Side-by-Side Reading, Glossary. UIDownload experience and Electron bundle Sync.
- Rust APITask Management, Library API, Artifact Download, Event Stream,reader, breakpoint recovery, and permission boundaries.
- Database and Persistence:job/artifact/event/glossary Recordsschema Compatibility, old data recovery, and storage paths.
- Python Pipeline:OCR Normalization, translation consistency, formula protection, renderingPDF Processing and failure diagnosis.
- Professional Testing: real-sample regression, boundary cases,fixtureAutomated scripts performance benchmarks acceptance checklist
- AI Development assistance: recommended for use. Codex or Claude CodeBreak tasks by project boundary, generate tests, perform code review, and update documentation.
- Docker、CIDocumentation maintainer release process.

## Subdocument

- [Frontend and Desktop Contribution Guide](doc/core/contributing/frontend.md)
- [Rust API Contributing Guidelines](doc/core/contributing/backend.md)
- [Database and Persistence Contribution Guide](doc/core/contributing/database.md)
- [Python Pipeline Contribution Guide](doc/core/contributing/python-pipeline.md)
- [Testing Contribution Guide](doc/core/contributing/testing.md)
- [AI Auxiliary Development Guide](doc/core/contributing/ai-development.md)
- [Issue、PR, Code Style and Release Notes](doc/core/contributing/process-and-style.md)

See also:

- [README](README.md)
- [Local Startup and Configuration](doc/core/api/local-dev.md)
- [Runtime Storage Structure](doc/core/api/storage.md)
- [Main branch documentation](doc/core/README.md)

## Local minimal startup

Backend:

```bash
cd backend/rust_api
# Prefer absolute DATA_ROOT/SCRIPTS_DIR so DB path storage never sees "../../data/...".
# Relative values still work after startup absolutization, but absolute is clearest.
RUST_API_BIND_HOST=0.0.0.0 \
RUST_API_DATA_ROOT="$(cd ../../data && pwd)" \
RUST_API_SCRIPTS_DIR="$(cd ../scripts && pwd)" \
cargo run
```

Frontend:

```bash
cd frontend
python3 -m http.server 40001 --bind 0.0.0.0
```

Default port:

- Rust API:`41000`
- multipart Async Submit API：`42000`
- Web frontend: `40001`

Docker Delivery also uses the same ports by default. If the local machine has already started Docker WebLocal static frontend can temporarily switch to another unused port. Changing port only affects browser access entry, no change to. Rust API Default port.

## Minimum pre-commit requirements

- Explain what was changed, why, and which modules are affected.
- Run corresponding tests or checks based on the scope of changes.
- If any checks haven't run, in PR Explain the reason in the description.
- Do not commit local keys.tokenReal user files`data/db/jobs.db`、`data/jobs/*`、`tmp/*` Or large-volume experiment output.
- Changes APIEvent database schemaDocumentation update when build output structure, module boundaries or deployment method change.

Maintainer release, Docker delivery, and online ops not in regular contributor mainline. See [Ops and Process Records](doc/ops/README.md) and Docker docs.
