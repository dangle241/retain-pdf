# 0003 Enforce via architecture checks. Python Module boundaries

## Background

As OCRTranslation, rendering, desktop Rust API Continuous growth: relying solely on human memory cannot maintain module boundaries long-term. File count itself is not the problem; cross-layer coupling is. import, circular dependencies, and provider Private field leak.

## Decision

Short-term, use existing repository content. `backend/scripts/devtools/check_pipeline_architecture.py` Commit Python Backend core boundaries. Integrate. CI。

Long-term, evaluate adoption of tach, import-linter, or grimp, but will not add new dependencies without first verifying the benefit.

The direction that must be maintained currently:

- `runtime/pipeline` Orchestrate only; no direct dependencies. provider raw、translation internals、rendering internals。
- translation and rendering do not consume provider raw JSON.
- `typst` No reverse proxy needed. import `redaction`。
- layout does not import source_pdf, typst, or redaction.
- `ocr_provider` No dependencies. translation/rendering。

## Consequences

- Structural violations fail architecture checks.
- New modules: either fit within existing boundaries, or update architecture docs and check rules first.
- Key boundaries not all at once. Tighten most vulnerable direction first.

## Alternatives

- Write only README Rely on convention. This solution has low execution cost, but will fail in the long run.
- Immediately adopt full third-party dependency governance tool. More systematic. Evaluate configuration cost and overhead first. CI Stability.
