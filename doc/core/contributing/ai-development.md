# AI AI-Assisted Development Guide

RetainPDF encourages using AI-assisted development. Recommended priority use of coding agents like Codex or Claude Code that can read/write local repositories, run commands, and execute tests, rather than just letting the model propose solutions out of thin air in the chat window.

AI Improves efficiency, but does not replace boundary checks, test validation, and ultimate responsibility. PR Responsible person must confirm changes conform to project architecture, pass required checks, and explain risks.

## Recommended tools

- CodexFor local repo: code changes, refactoring, testing, doc cleanup, pre-release checks.
- Claude CodeSuitable for long-context code reading, cross-file refactoring, test generation, and summarizing complex changes.

Use standard linters. Run `make lint` before commit. AI Participate in development, suggest at PR Briefly explain in description. AI What parts were involved, e.g., "assisted test generation", "assisted documentation collation", "assisted refactoring". import Boundary

## Suggested AI Skills

You can write the following capabilities below as Codex skill、Claude Code commandor within the project agent checklist。

### RetainPDF Project context

Purpose: to let AI Understand repository boundaries before taking action.

Should include:

- Project root directory:`/home/wxyhgk/tmp/Code`
- Main modules`backend/rust_api/`、`backend/scripts/`、`frontend/`、`frontend-react/`、`desktop/`、`docker/`、`doc/`
- Core rule: Do not roll back unrelated dirty changes; use manual editing. patchBefore modifying, read surrounding code; run tests per module.
- Documentation entry: root directory CONTRIBUTING.md and doc/core/contributing/README.md

### Rust API Boundary Check

### Rust API boundary check

Remind AI：

- routes/* only do HTTP adapter.
- service Layer performs business aggregation and view/projection。
- `job_runner/*` Execute at runtime.
- Database access passed. `Db` facade, not in route Write directly inside. SQL。
- New APIs keep fields in sync with documentation and tests.

Common Checks:

```bash
cargo fmt --manifest-path backend/rust_api/Cargo.toml --check
cargo test --manifest-path backend/rust_api/Cargo.toml
cd backend/rust_api && python3 scripts/check_architecture.py
```

### Python Pipeline boundary check

### Python pipeline boundary check

Remind AI:

- OCR raw payload enters document_schema first, produces document.v1.
- translation does not import rendering.
- rendering only consumes source PDF, translation manifest, page payload, and render spec.
- Add formulas, terminology,bboxMinimal regression test add for render strategy.

Common checks:

```bash
python3 backend/scripts/devtools/check_pipeline_architecture.py
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/translation -q
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/rendering -q
```

### Sync frontend with desktop.

### Sync frontend with desktop

Remind AI:

- Modify `frontend/**` Run later. `npm --prefix desktop run verify-frontend-sync`。
- Don't just change it. `desktop/app/frontend/**`。
- `frontend-react/` Migration zone, not default replacement. `frontend/`。
- The default port for the local static frontend is `40001`。

Common checks:

```bash
npm --prefix frontend run build
npm --prefix desktop run verify-frontend-sync
```

### Test and regression generation

### Test and regression generation

Remind AI to output:

- Environment, version,provider、workflow。
- Is the sample publicly available?
- Page numbers,bboxScreenshot take.job_id。
- Reproduction steps, expected result, actual result.
- Minimal fixture or automated testing suggestions.

### Documentation consistency check

Purpose: keep documentation in sync with code changes.

Remind AI to check:

- API Sync field? `doc/core/api/`。
- Rust Boundaries synchronized? `doc/core/rust_api/`。
- Python boundaries synchronized with doc/core/python/.
- Frontend,DockerWhether desktop ports and commands are consistent.
- root directory `CONTRIBUTING.md` Is it still just a short entry?

## Recommended workflow

## Recommended workflow
2. Requirements AI Provide the impact scope and verification plan.
3. Have AI commit small patches without unrelated formatting.
4. Run corresponding tests or checks.
5. Have AI perform a review focusing on cross-layer dependencies, legacy compatibility, test gaps, and documentation gaps.
6. Manual confirmation of output, risks, and PR description.

## Prompt suggestions

Can directly say to Codex or Claude Code:

```text
You are in RetainPDF working in the repository. Read first CONTRIBUTING.md and related doc/core/contributing Subdocument.
Only modify files relevant to this task; do not revert unrelated dirty changes.
Before changes, state impact scope. After changes, run corresponding tests.
If tests cannot run, state cause and remaining risks.
```

Backend:

```text
Check whether this Rust API Cần biết thay đổi cụ thể và vi phạm điều gì. Cung cấp thêm thông tin. routes -> services -> job_runner/db Boundary.
Key points route Enable business spelling? JSON、service Direct dependency? HTTP Response、job_runner Reverse dependency? service。
No context. Specify error/log/target. Provide reproduction or description.
```

Targeting Python：

```text
Check translation, rendering, ocr_provider for cross-layer imports.
Do not let translation import services.rendering.
If data sharing is needed, via manifest/spec/document.v1 Pass.
```

For testing:

```text
Take this bug Organize report into reproducible test cases.
Include environment, sample, page number,bboxReproduction steps. Expected result. Actual result. Suggested automation test points.
```

## Notes

- AI Generated code must be manually reviewed. review。
- AI Do not commit real user files private tokenLocal database or large-volume artifacts.
- AI When refactoring, specify which redundancies or couplings are replaced; do not add abstractions solely for the sake of "generality."
- AI Modify ReleaseDockerDesktop packaging process. Add rollback method rollback steps. Add validation method validation steps.
