# resources

This directory is for repository-level resources, to avoid putting logoAnimation files, sample files, local runtime files scattered `backend/`、`frontend/`、`desktop/` Wait in source directory.

## Classification

- `brand/`：logoQR code, brand image, release showcase image.
- `animations/`Motion assets, demo animations, loading animation source files.
- `samples/`Example PDFTest input files public small samples.
- `runtime/`Archive entry for local runtime or platform binaries. Do not move directly before formal migration. `backend/python`、`backend/typst-win32` Such paths require synchronous updates to the packaging script.
- `misc/`Resources temporarily unclassifiable. Clean periodically to avoid long-term accumulation.

## Not recommended here.

- Source code: keep here `backend/`、`frontend/`、`desktop/`。
- Task data: continue placing `data/jobs`、`data/uploads`、`data/downloads`。
- Key file: do not commit to repository.
- Large build artifacts: prefer ignore or place in release artifacts; do not commit.

## backend Cleanup suggestions

`backend/` The real suspect isn't source code—it's local runtime and build artifacts:

- `backend/rust_api/target/` contains Rust Build artifacts that can be deleted and recompiled.
- `backend/python/` is Windows desktop Python runtime. Currently referenced by packaging script. Must change before migration. `desktop/scripts/prepare-app.mjs`.
- `backend/typst-win32/` is Windows Typst runtime. Synchronize desktop packaging logic before migration.

Therefore, only add new items in the short term to `resources/` entry; do not move directly to `backend/scripts` or `backend/rust_api`.
