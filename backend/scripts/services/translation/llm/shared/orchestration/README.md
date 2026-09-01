# Translation LLM Orchestration

This layer does one thing:
Single block / Single Batch items Orchestrate translation requests to be stable, revertible, and diagnosable. provider Call flow.

It is not responsible for:

- Provider-specific HTTP details
- OCR payload Extract
- page payload Backfill to disk.
- PDF rendering

## Newcomers read first

- See main entry:
  `retrying_translator.py`
- To see plain-text single degradation main chain
  `single_item_flow.py`
- View routing wrapper for single orchestration:
  `single_item_routes.py`
- To see fallback facade:
  `fallbacks.py`
- To see formula segment routing:
  `segment_routing.py`
- To see formula segment request/switch window execution:
  `segment_request.py` / `segment_windows.py` / `segment_executor.py`
- To see direct-typst special paths:
  `direct_typst.py`
- To see batch/cache/tail retry:
  `batched_plain.py`

## Current boundary

- `retrying_translator.py`
  shared orchestration Stable entry.
  Responsible only `translate_batch` / `translate_items_to_text_map`Remove orchestration logic. Hide history. `_xxx` Private API。

- `fallbacks.py`
  plain-text Single Orchestration facade。
Responsibilities:
  - Preserve top-level tests/Entry point
  - Via explicit dependency injection facade Test doubles pass to. `single_item_flow.py`
  - Forward to `single_item_flow.py`
  Discard tagged-placeholder and other old private path wrappers.

- `single_item_flow.py`
  plain-text Single orchestration main chain.
Responsibilities:
  - select direct-typst / segmented / plain-text Main Path
  - tagged placeholder first Decision
- Single plain-text attempt loop
- Sentence-level fallback integration

- `single_item_deps.py`
  Explicit dependency injection object for single orchestration.
Only responsible for passing provider calls, segment calls, sentence fallback, validation, and other replaceable functions centrally into `single_item_flow.py`.

- `single_item_routes.py`
  Route wrapper for single orchestration.
Only responsible for direct-typst, heavy-formula, tagged-placeholder these replaceable route call shape, avoiding `single_item_flow.py` continuing to carry test doubles and historical wrapper entry points.

- `batched_plain.py`
  batched plain-text Orchestration.
Responsibilities:
  - cache hit / cache drop
- Low-risk batch decision
  - batch partial accept + retry split
  - transport tail retry pass

- `direct_typst.py`
direct-typst main retry loop.
Responsibilities:
  - direct-typst plain/raw Two paths. attempt loop
  - validation failure Final closure after
- Sentence fallback / transport degrade integration

- `direct_typst_long_text.py`
  direct-typst Pre-split long text.
  Only responsible for splitting blocks and chunk Level reassembly, do not process. provider transport。

- `direct_typst_salvage.py`
  direct-typst protocol/json shell salvage。
  Only responsible for extracting acceptable translations from abnormal text and performing partial accept。

- `heavy_formula.py`
  heavy formula block Pre-split.
Only responsible for:
- Whether heavy split is needed
  - How to placeholder Split density blocks
  - chunk After retrying at level, reassemble.

- `plain_text_validation.py`
  plain-text validation Failure cleanup logic.
Only responsible for:
  - protocol shell salvage
  - English residue partial salvage
- Repeated validation failure final degrade decision

- `sentence_level.py`
  sentence-level fallback。
  Only: sentence-level split, per-sentence request, partial-success reassembly.

- `segment_routing.py`
Formula segment external routing facade.
  Exposes only. routing / risk / plan Entry point, forwards execution to executor。

- `segment_request.py`
Formula segment provider request.
Only responsible for tagged/json dual-format request and response parsing and format error handling.

- `segment_windows.py`
Formula segment single-window retry.
Only handles window context merging, at window level attempt loop and provider request invocation.

- `segment_executor.py`
Formula segment execution orchestration.
  Single window only./Multi-window overall process, result reassembly.validation and failed window closure.

- `segment_failures.py`
Formula segment failure payload construction.
  Only responsible for unifying window failure diagnostics. `failed` payload。

- `transport.py`
  transport tail retry / DLQ Common logic.

- `terminal_payloads.py`
  Final state payload Constructor.
Convention:
  - clearly non‑translatable/Use only if content is skippable. `kept_origin`
  - provider、transport、validation、chunk/window Use uniformly for failures. `failed`
  - `failed` Default `fallback_to=retry_required`Export gate blocks semi-finished products.

- `keep_origin.py`
  keep-origin Compatibility entry.
  When adding a failure terminal state, use it first. `terminal_payloads.py`, do not write failure as keep-origin。

- `metadata.py`
  translation_diagnostics / formula diagnostics / runtime term restore。

- `common.py`
  Text length,continuation、CJK、placeholder Quantity and other pure judgment tools.

## Call Chain

Most common call chain:

`retrying_translator.py`
-> `fallbacks.py` / `single_item_flow.py`
-> `direct_typst.py` / `segment_routing.py` / plain-text provider runtime
-> `terminal_payloads.py` / `plain_text_validation.py` / `sentence_level.py`

batch Path:

`retrying_translator.py`
-> `batched_plain.py`
-> `fallbacks.py`

## Subsequent conventions

- New degradation strategy: preferentially place into corresponding responsibility module; do not pile back to `fallbacks.py` or `retrying_translator.py`
- Failure is not keep-originExcept fast-path metadataAll terminal states must be written in English. `failed`。
- `fallbacks.py` Keep thin facade Reposition: stop embedding real flows or old private aliases.
- `retrying_translator.py` Maintain stable entry positioning; do not cram additional content. `_xxx_impl` Historical aliases and actual workflow
- Provider-specific logic kept elsewhere. Unified under `shared/provider_runtime.py` and subsequent provider implementations
- If a module exceeds again. 400-500 OK, prioritize by responsibility, not mechanically by code blocks.
