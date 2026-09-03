# Pipeline Shared description

`services/pipeline_shared/` Cross-stage shared, not belonging to any single provider Common protocol layer.

Currently hosts three main types:

- `events.py`
  Python worker Unified stage events writerAll remove. OCR / translation / render All fine-grained events write through here. `logs/pipeline_events.jsonl`。
- `contracts.py`
provider/translate/render workers share stdout label and summary file name.
- `io.py`
  neutral JSON flush to disk helper。
- `source_json.py`
Main branch checkout: raw provider layout and normalized document formal neutral input rule select.
- `summary.py`
Mainline worker shared pipeline summary generate and print logic

Design boundaries:

- Stage-level shared protocols only. No others. MinerU、Paddle Like this. provider Private semantics.
- Only general capabilities required by the mainline go here. Not translation strategies, rendering implementations, or. OCR Adaptation details.
- `services/mineru/` Keep compatibility shim, but new mainline dependencies should point here first.
- Event primary semantics must be written as top-level fields, not just stuffed into `payload`。
- `message` for human viewing only; frontend and Rust API canonicalize Never rely on it to guess the stage.

## Event field conventions

Python Original events must be stably carried:

- `user_stage`：`ocr | translation | render | done`
- `stage`：Python Internal Machine Phase
- `substage`Machine-readable subphase.
- `stage_detail`User-readable short copy
- `event_type`Original event type, e.g. `stage_progress`
- `semantic_event_type`Semantic event type, e.g. `progress`
- `progress_current`
- `progress_total`
- `progress_unit`
- `payload`

Current stable sub-stages include:

- `ocr_processing`
- `normalizing`
- `translation_prepare`
- `domain_inference`
- `page_policies`
- `continuation_review`
- `translation_batches`
- `translation_tail_retry`
- `garbled_repair`
- `agent_repair`
- `final_untranslated_recovery`
- `render_prepare`
- `render_prewarm`
- `render_pages`
- `render_compile`

Sync updates when adding a substage. Rust Mapping:

- `backend/rust_api/src/models/job/stage.rs`
- `backend/rust_api/src/services/jobs/presentation/live_stage/canonical_events.rs`

For full protocol, see:

- `doc/core/rust_api/11-stage-events-and-failure-protocol.md`

Layer goal: not add abstraction. Remove original attachment from `services/mineru/*` Consolidate shared capabilities under neutral module to facilitate backend evolution into modular monolith.
