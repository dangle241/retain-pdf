# Contribution Guide

Thank you for your interest in contributing to RetainPDF. This project includes a Rust API, a database layer, a Python OCR/translation/rendering pipeline, a static frontend, a desktop build, and Docker delivery. The most important principles for contributions are: clear module boundaries, verifiable changes, and reproducible issue reports.

## Contribution Areas

- **Frontend and Desktop**: task status UI, side-by-side reading, glossary UI, download experience, and Electron bundle synchronization.
- **Rust API**: task management, library endpoints, artifact downloads, event streaming, reader, breakpoint recovery, and permission boundaries.
- **Database and Persistence**: job/artifact/event/glossary records, schema compatibility, legacy data recovery, and storage paths.
- **Python Pipeline**: OCR normalization, translation consistency, formula protection, rendering, PDF processing, and failure diagnostics.
- **Professional Testing**: real-sample regression, edge cases, fixtures, automation scripts, performance benchmarks, and acceptance checklists.
- **AI-Assisted Development**: Codex or Claude Code are recommended; split tasks along project boundaries, generate tests, and assist with code review and documentation.
- **Docker, CI, documentation, and maintainer release process.**

## Sub-documents

- [Frontend and Desktop Contribution Guide](doc/core/contributing/frontend.md)
- [Rust API Contribution Guide](doc/core/contributing/backend.md)
- [Database and Persistence Contribution Guide](doc/core/contributing/database.md)
- [Python Pipeline Contribution Guide](doc/core/contributing/python-pipeline.md)
- [Testing Contribution Guide](doc/core/contributing/testing.md)
- [AI-Assisted Development Guide](doc/core/contributing/ai-development.md)
- [Issues, PRs, code style, and release notes](doc/core/contributing/process-and-style.md)

See also:

- [README](README.md)
- [Local startup and configuration](doc/core/api/local-dev.md)
- [Runtime storage structure](doc/core/api/storage.md)
- [Mainline documentation](doc/core/README.md)

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

Default ports:

- Rust API: `41000`
- Multipart async submit API: `42000`
- Web frontend: `40001`

Docker delivery uses the same set of ports by default. If Docker Web is already running on this machine, the local static frontend can be temporarily switched to another unused port. Changing the port only affects the browser entry point; it does not change the default Rust API port.

## Minimum pre-commit requirements

- Explain what was changed, why, and which modules are affected.
- Run the relevant tests or checks based on the scope of the change.
- If a check was not run, explain the reason in the PR description.
- Do not commit local keys, tokens, real user files, `data/db/jobs.db`, `data/jobs/*`, `tmp/*`, or large experiment outputs.
- When the API, events, database schema, artifact structure, module boundaries, or deployment method changes, update the documentation in the same PR.

Maintainer releases, Docker delivery, and production operations are outside the regular contributor mainline. See [Ops and Process Records](doc/ops/README.md) and the Docker docs for related material.
