# backend Directory description

`backend/` Currently contains backend source code, packaged resources, and local runtime artifacts. When organizing, do not treat it as a pure source directory and move it directly.

## Retain in backend Content

- `rust_api/`：Rust API service source code.DockerDesktop and system service both access via `RUST_API_ROOT` Or locate it using a fixed path.
- `scripts/`：Python OCRTranslation pipeline source code.GitHub Actions、DockerDesktop build package local test use this path directly.
- `fonts/`Packaging and Docker Chinese font resources to copy; official release assets, not cached.

## Local or platform runtime artifacts

- `rust_api/target/`：Rust Build artifacts are large and have been `.gitignore` Ignore. Safe to delete and recompile.
- `python/`：Windows Desktop packaging. Python runtimehas been `.gitignore` Ignore. If refactoring later, suggest moving to root directory. `local-runtime/windows/python/` Or desktop-only. runtime Table of contents, and synchronize updates. `desktop/scripts/prepare-app.mjs`。
- `typst-win32/bin/`: Windows Typst executable file directory, has been `.gitignore` ignored. `typst-win32/.crates.toml` and `.crates2.json` still visible; further guidance to follow. Typst runtime archive together.
- `workspace/`History/Local temporary workspace. Do not use as source code entry point for further expansion.
- `.ipynb_checkpoints/`、`.pytest_cache/`、`__pycache__/`Editor and Python Cache can be deleted.
- `scripts/.env/*.env`、`rust_api/auth.local.json`Local secret configs; do not commit.

## Recommended organization directions

Don't move first. `scripts/` or `rust_api/` runtime archive entry at repo root safer. Add `runtime.tar.gz` at root. `local-runtime/` stores local binaries and platforms. runtime and large-volume reproducible files.

Target structure can be:

```text
backend/
  rust_api/        # Rust API Source code
scripts/         # Python pipeline source code
  fonts/           # Publish font assets

local-runtime/
  windows/python/  # Windows Python runtime
  windows/typst/   # Windows Typst runtime
  README.md
```

Sync updates required before actual migration:

- `desktop/scripts/prepare-app.mjs`
- `.github/workflows/release-desktop.yml`
- `docker/Dockerfile.app`
- Related README and the fixed path in tests

## Current split boundary

Backend decoupling status governed by mainline docs and architectural gates. Current stable boundaries:

- Rust API Responsible for task statusstage specEventartifact References and process orchestration.
- Python `backend/scripts/runtime/pipeline/` Stage orchestration only; no direct consumption. OCR provider Original structure.
- Python Translation entry `services.translation.workflow` facade。
- Python render source PDF preprocessing goes through `services.rendering.source.render_source` and `services.rendering.source.preparation.*`Remove unnecessary code. Optimize. hidden-text strip / compression write details back to runtime pipeline.
- OCR provider Original product must be entered first. `document.v1.json`Translation and rendering consume only. normalized document and translation artifacts。

Before adding cross-layer dependencies, run:

```bash
python3 backend/scripts/devtools/check_pipeline_architecture.py
python3 backend/scripts/devtools/check_stage_specs_contract.py data/jobs
```

## Immediate security cleanup

To free up space, delete these. ignored Directory, no effect. Git History:

```bash
rm -rf backend/rust_api/target
find backend -type d \( -name '__pycache__' -o -name '.pytest_cache' -o -name '.ipynb_checkpoints' \) -prune -exec rm -rf {} +
```

Recompile after deletion. Rust API。
