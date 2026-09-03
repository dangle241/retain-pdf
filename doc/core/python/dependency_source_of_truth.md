# Python Single source of truth

The current repository's Python Dependency truth source has converged to the root directory. [`pyproject.toml`](../../pyproject.toml)。

## How to maintain now

- Runtime dependencies:
  `project.dependencies`
- Test dependencies:
  `project.optional-dependencies.test`
- Python version:
  `project.requires-python`
- Non‑Python binary dependencies:
  `tool.retain_pdf.external-binaries`

Do not manually edit generated artifacts directly.

- [`docker/requirements-app.txt`](../../docker/requirements-app.txt)
- [`docker/requirements-test.txt`](../../docker/requirements-test.txt)
- [`desktop/requirements-desktop-posix.txt`](../../desktop/requirements-desktop-posix.txt)
- [`desktop/requirements-desktop-windows.txt`](../../desktop/requirements-desktop-windows.txt)
- [`desktop/requirements-desktop-macos.txt`](../../desktop/requirements-desktop-macos.txt)

## Update method

After modifying pyproject.toml, run:

```bash
python backend/scripts/devtools/sync_python_requirements.py --repo-root .
```

To only check for drift:

```bash
python backend/scripts/devtools/sync_python_requirements.py --repo-root . --check
```

## Current definition

Runtime Python packages:

- `Pillow`
- `PyMuPDF`
- `pikepdf`
- `requests`
- `urllib3`

Test extra package:

- `pytest`

Non‑Python binary dependencies:

- `typst`Required
- `gs`Compress path dependencies (optional)

## Missing context. Provide code or scenario to analyze rationale.

Before Docker、desktop、CI Maintain separately requirementsEasily occurs:

- Platform missing package.
- Runtime and desktop packaged version drift.
- CI Passed, but local or release build fails.

The current goal is:

- Change in one place only
- Generated in multiple places
- CI uses --check to prevent drift into main.
