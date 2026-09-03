# backend directory

`backend/` currently contains the backend source code, packaged resources, and local runtime artifacts. When reorganizing the repo, do not treat it as a pure source directory and move it as-is.

## What stays in `backend/`

- `rust_api/`: Rust API service source. The Docker image, the desktop app, and the system service all access it through `RUST_API_ROOT` or a fixed path.
- `scripts/`: Python OCR + translation pipeline source. GitHub Actions, Docker image builds, and the desktop app's local development path all use it directly.
- `fonts/`: Chinese font resources copied during packaging and into Docker images. These are official release assets and must not be cached.

## Local or platform runtime artifacts

- `rust_api/target/`: Rust build output. Large and already excluded by `.gitignore`. Safe to delete and recompile.
- `python/`: Python runtime used by the Windows desktop packaging. Already excluded by `.gitignore`. If you refactor later, consider moving it to a root-level `local-runtime/windows/python/` or to a desktop-only runtime directory, and update `desktop/scripts/prepare-app.mjs` in lockstep.
- `typst-win32/bin/`: Windows Typst executable directory, already excluded by `.gitignore`. Note that `typst-win32/.crates.toml` and `typst-win32/.crates2.json` are still tracked; further guidance will be added when the Typst runtime archive layout is finalized.
- `workspace/`: Historical and local temporary workspace. Do not use as a source code entry point for further expansion.
- `.ipynb_checkpoints/`, `.pytest_cache/`, `__pycache__/`: Editor and Python caches. Safe to delete.
- `scripts/.env/*.env`, `rust_api/auth.local.json`: Local secret configurations. Never commit.

## Suggested reorganization direction

Before any move, prefer placing a single runtime archive entry at the repo root. `scripts/` and `rust_api/` are easier to discover that way, and a top-level `local-runtime/` cleanly absorbs the per-platform binaries and large reproducible files instead of scattering them under `backend/`.

A target structure could look like:

```text
backend/
  rust_api/        # Rust API source
  scripts/         # Python pipeline source
  fonts/           # Published font assets

local-runtime/
  windows/python/  # Windows Python runtime
  windows/typst/   # Windows Typst runtime
  README.md
```

Before doing the actual migration, sync updates are required in:

- `desktop/scripts/prepare-app.mjs`
- `.github/workflows/release-desktop.yml`
- `docker/Dockerfile.app`
- Related READMEs and the fixed paths used in tests

## Current split boundary

Backend decoupling is governed by the mainline documentation and the architectural gates. The current stable boundaries are:

- The Rust API owns task status, the stage spec, events, artifact references, and process orchestration.
- Python under `backend/scripts/runtime/pipeline/` is stage orchestration only; it does not consume the OCR provider's original structure directly.
- The Python translation entry point is the `services.translation.workflow` facade.
- The Python render source-PDF preprocessing goes through `services.rendering.source.render_source` and `services.rendering.source.preparation.*`. Do not write hidden-text stripping or compression details back into the runtime pipeline; keep them in the rendering layer.
- The OCR provider's original product output must be normalized into `document.v1.json` first; translation and rendering only consume the normalized document and the translation artifacts.

Before adding cross-layer dependencies, run:

```bash
python3 backend/scripts/devtools/check_pipeline_architecture.py
python3 backend/scripts/devtools/check_stage_specs_contract.py data/jobs
```

## Immediate cleanup

To free up space, delete these ignored directories. This does not affect Git history:

```bash
rm -rf backend/rust_api/target
find backend -type d \( -name '__pycache__' -o -name '.pytest_cache' -o -name '.ipynb_checkpoints' \) -prune -exec rm -rf {} +
```

Recompile the Rust API after the deletion.
