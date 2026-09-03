# Translation workflow boundaries

`services.translation.workflow` It is the orchestration layer for the full-book translation.
It handles stable protocols and policies./Context preparation.LLM Link execution, result backfill, persistence, diagnostics, and events.
But a single file should not handle all responsibilities.

## Current entry point

- `execution.py`
  Outbound request object and execution entry point.
- `execution_plan.py`
Generates an immutable execution plan based on OCR JSON, policy configuration, glossary, context, and provider diagnostic configuration.
- `execution_runner.py`
  Execute the plan and write out manifest、review、diagnostics Wait for consolidated output.
- `book_flow.py`
  Current full‑book translation stage order.

## Target directory

- `phases/`
  Subsequent handover currently concentrated on `stages.py` Internal stage implementation.
One phase can call policy, continuation, LLM, or repair services, but event format and storage details should be narrowed.

- `scheduling/`
Subsequent queue distribution and batch handling, worker result drain, tail retry, and flush strategies.
These logics are currently scattered across batch_runner.py, workers.py, and batching/pending_units.py.

- `legacy/`
  Subsequently adopt the legacy page-by-page translation compatibility path.
  Currently mainly `translation_workflow.py`and still need it debug-only Caller.

- `batching/`
  Batch construction rules: deduplication, low-risk batching assessment.fast-path Planning and pending-unit Select.
  It should not be responsible. provider transportnor should it be responsible for page file persistence.

## Boundary rules

- Workflow orchestrates services but should not contain provider-specific HTTP logic.
- Workflow Send pipeline eventsBut event contracts must be stable, cannot rely on log message Inference phase.
- Batch scheduling Translate faithfully. No deviation. Return only:  Should not decide translation quality policy. Only execute prepared translations. unitsand expose structured failures.
- Result flush Should not rebuild global translation-unit Status unless caller explicitly requests.
- Rendering prewarm belongs to runtime/pipeline responsibility; translation should not internally import rendering modules.

## Migration Order

1. By responsibility, move `stages.py` Stage implementation migrated to `phases/`。
2. Migrate queue worker / tail retry from batch_runner.py to scheduling/.
3. Move old page-by-page helpers to legacy/, remove after no production calls or production exports.
