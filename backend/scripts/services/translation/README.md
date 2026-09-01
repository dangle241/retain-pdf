# Translation description

This layer only does one thing: take OCR payload Persistable, backfillable, renderable translation output.

Not responsible here. PDF Not responsible for reading and writing back either. MinerU Unpack.

## Stage boundaries

The formal inputs and outputs of the translation stage are fixed as:

- Input:
  `document.v1.json`Translation strategy parameters Translation output directory
- Output:
  Page by page translation payload, translation summary, translation diagnostics

Clearly not responsible for:

- Do not directly consume provider raw JSON, zip, or unpacked directories
- Not responsible for source PDF page write-back, layout override, and final PDF delivery
- Not responsible for OCR provider upload, poll, download, normalize artifact generation

## Default translation strategy.

Default policy: human translation workflow, not whole-page model dump.

1. Current block first
   Each translation uses the current item the source text of the current item as the sole output object. Context, terms, and document memory can only assist understanding and must not be translated into the current block.
2. Inject terms on match.
User glossary and automatic document memory are not fully loaded into prompt; the main translation chain will first match terms against the current item or batch's source text, only matched preferred terms are injected as translation preferences. preserve/canonical hard constraints: placeholder protection first.
3. Context injection on demand
Complete ordinary body paragraphs default to no surrounding context to reduce prompt size and avoid neighboring paragraphs being mistakenly translated into the current block. Only scenarios like cross-column/page continuations, candidate continuations, captions, conjunction-starting fragments, short incomplete fragments will include reading-order surrounding context. For debugging old behavior, mode="all" can be used to retain full neighbor context.
4. Quality fallback cannot be disabled.
Items with should_translate=true cannot end with empty translation. Standard translation, short text retry, encoding corruption fix, and agent repair treat empty translations as fixable issues; advanced options control context/terminology/quality budget, but do not disable the final empty-translation fix guarantee.

### Advanced Options

Backend translation request supports three advanced options,Rust API Will be written stage spec and pass to Python Translation Execution Layer:

| Field | Default | Optional Values | Meaning |
| --- | --- | --- | --- |
| context_mode | needed | needed / all / off | Controls reading-order surrounding context. needed only for incomplete snippets, continuations, captions, and context-dependent blocks; all reverts to old neighbor context behavior; off clears all context. |
| `glossary_mode` | `matched` | `matched` / `all` / `off` | Control user vocabulary injection.`matched` Inject only current. item/batch Matched terms;`all` Submit entire table prompt；`off` do not inject glossary. |
| `memory_mode` | `matched` | `matched` / `broad` / `off` | Control Automatic Document Memory.`matched` Inject only current. item/batch Matched historical terms;`broad` Inject document-level summary.`off` Disable memory injection. |

These options only affect prompt Context budget and terminology/Memory injection scope; does not affect final quality fallback. Empty translations, severe English residue, and placeholder errors must still enter the follow-up fix pipeline.

Default: auto document memory read once at task start. `JobMemorySnapshot`，worker No real-time write-back during concurrent translation.
`job-memory.json`This can avoid big. PDF Repeated file locking and flushing under high concurrency. prompt Memory and slow tail batch. When debugging old behavior,
Configurable. `RETAIN_TRANSLATION_LIVE_MEMORY_UPDATES=1`Keep result backfill phase updating in real time. job memory。

Current stable handoff point:

- Upstream OCR stage should first converge providers to document.v1.json
- Downstream render stage consumes only disk translation output, no upstream interpretation of OCR provider private fields

Default translation output protocol:

- `translation-manifest.json`
Record page index to translation payload Stable file mapping, priority read during render phase.
Also includes lightweight metadata, e.g., glossary summary, diagnostic summary, and invocation field
  Current production path uniformly marked as `stage_spec`
- Per-page translation payload
  Currently still one per page. JSON Write to disk,manifest Declares how render phase discovers these files.
- Stage spec
translate-only entry already supports job_root/specs/translate.spec.json (translate.stage.v1)
- Debug artifacts
  - `artifacts/translation_diagnostics.json`
  - `artifacts/translation_debug_index.json`

## Translation Payload Scope

Per-page translation payload now split into two layers:

1. Top-level contract fields
2. metadata debug/bridge fields

Top-level contract fields include:

- `block_kind`
- `layout_role`
- `semantic_role`
- `structure_role`
- `policy_translate`
- `asset_id`
- `reading_order`
- `raw_block_type`
- `normalized_sub_type`

Current convention:

- Translation classification, style hint, policy, payload backfill, and diagnostics main chain priority reads only top-level contract fields
- `metadata` May remain, but responsibilities limited to debug、provider trace and Bridging `continuation_hint/provider warning`
- New logic: do not ... again `metadata.layout_role`、`metadata.semantic_role`、`metadata.structure_role` Formal Semantic Entry
- Subsequent block Change semantics. Prioritize only modifications. `document.v1 -> TextItem -> payload` this contract Projection: do not let downstream modules re-translate separately. `metadata`

Compatibility conventions:

- New task directory should be generated. `translation-manifest.json`
- The translation output protocol is fixed as. `translation-manifest.json` + Per page payloadRendering phase no longer compatible with legacy page-by-page. JSON Direct Scan Mode
- Default load metric already. strict contractMissing the above top-level fields. payload will error directly
- The translate-only worker called by the Rust main workflow now requires --spec
- `scripts/entrypoints/translate_book.py` is now also spec-only Packaging Entry
- API credentials no longer need to be written to stage spec; use credential_ref in spec, injected by runtime environment with real key

## Debug Loop

Now there is a minimal reproducible chain, specifically for locating "why a certain item was not translated / downgraded / kept original text":

1. Check debug artifacts first.
   - `translation_diagnostics.json` View global statistics
- translation_debug_index.json to see item-level index
2. Review the order again. item
   - `backend/scripts/devtools/replay_translation_item.py`
3. Connect when batch regression needed. promptfoo
   - `backend/scripts/devtools/promptfoo/`
   - First use `scan_drift.py` find saved vs replay Drift term, reuse. `capture_case.py` Solidify into case artifact

Rust API Correspondingly exposes:

- `GET /api/v1/jobs/{job_id}/translation/diagnostics`
- `GET /api/v1/jobs/{job_id}/translation/items`
- `GET /api/v1/jobs/{job_id}/translation/items/{item_id}`
- `POST /api/v1/jobs/{job_id}/translation/items/{item_id}/replay`

## Subdirectories and boundaries

Stable responsibility directories first. New code go there. Root big files stop.

Root directory only `README.md` Initialize wallet. No new code. `translation/*.py`
Large file; required by external module. translation When capable, prioritize. `public/`。

| Directory | Responsibilities | Unnecessary work |
| --- | --- | --- |
| `entrypoints/` | Python worker Entry script implementation, e.g. translate-only、book translation pipelineCompat root same-name file only for compatibility. shim。 | No business rules. No exceptions. workflow Reverse dependency. |
| workflow/ | Translation workflow orchestration, phase scheduling, batch/worker allocation and main process flush to disk. | Not needed: remove provider HTTP payload; do not write specific policy rules. |
| core/ | Stabilize domain model and data protocol: item contract, document.v1 reading, translation payload, manifest, orchestration. | Do not call LLM, do not manage job lifecycle. |
| `services/` | Translation business capabilities:policy、continuation、classification、context、terms、memory、quality、agents、postprocess、results。 | No external entry parsing; no direct dependencies. runtime pipeline。 |
| `llm/` | LLM provider、prompt Protocol, cache, response parsing, retry, and validation entry point. | Do not read. OCR File; does not determine page level. workflow。 |
| `artifacts/` | Structured Diagnosisdebug index、review artifactRun stats output. | No liability for business decisions. No invocation. provider。 |
| public/ | Provide stable facade for runtime, rendering, ocr_provider, and other external production code. | No business logic. Avoid accidentally exposing internal temp code helpers. |

### Public entry point

production Code in translation When externally referencing this module, default allows only:

- `services.translation.public`
runtime, rendering, ocr_provider shared stability contracts, e.g., glossary entry, provider runtime defaults, translation manifest reading, item role helpers, formula protection helpers, diagnostics writer.
- `services.translation.entrypoints.*`
  CLI/worker Entry script usage.

The following production Directory should not be directly import translation Internal implementation:

- `runtime/pipeline/**`
- `services/rendering/**`
- `services/ocr_provider/**`
- `services/mineru/**`
- `services/document_schema/**`

Do not directly reference these directories:

- `services.translation.core`
- `services.translation.services`
- `services.translation.llm`
- `services.translation.workflow`
- `services.translation.artifacts`

If these external modules indeed require new. translation Capability: design for stability first. contract Add later `public/`then called externally.

`public/` must remain lazy facade: do not `services/translation/public/__init__.py` write at top level
from services.translation... import ... or from services.rendering... import ... add export registration only
_EXPORTS via __getattr__ loads on demand, avoiding translation and rendering creating import cycles.

### Devtools Test exception

backend/scripts/devtools/** and backend/scripts/devtools/tests/** can directly import translation internal modules for:

- Unit testing internal rules, payload helpers, LLM protocol, and policy branches
- replay / promptfoo / repair runner These debugging tools
- golden flow or schema regression checks

These are debug/test-only exceptions, not representative of production code. When adding normal runtime paths, workers, OCR/normalize, rendering, or runtime code,
Default must still be used. `services.translation.public`If any devtools Script will be production Call: provide dependencies first. translation Converge capabilities to
`public/`Then connect to the main chain.

### Dependency direction

Target dependency direction:

```text
entrypoints
  -> workflow / pipeline_shared / foundation
workflow
  -> core / services / llm / artifacts
core
  -> core
services
  -> core / llm / artifacts
llm
  -> core / artifacts
artifacts
  -> core
public
  -> core / workflow / llm provider runtime / artifacts
```

A few transitional exceptions remain:

- `workflow/execution_runner.py` Will start render source prewarmThis is to preheat render input in parallel with translation; exceptions must remain narrow.

Closed boundaries:

- core: pure contracts, data read, payload data operations, and text rules; do not import services, workflow, or llm
- `llm` Stop reading `services/context`、`services/memory`、`services/quality`、`services/terms`
- artifacts no longer reads services/agents or LLM control context; review summary built in services/agents/review_artifact.py
- services can combine core, llm, and artifacts, but must not reverse-depend on workflow

Removed Compatibility shim：

- `translation/from_ocr_pipeline.py` -> `translation/entrypoints/from_ocr_pipeline.py`
- `translation/translate_only_pipeline.py` -> `translation/entrypoints/translate_only_pipeline.py`
- `translation/item_reader.py` -> `translation/core/item_reader.py`
- `translation/session_context.py` -> `translation/services/context/session_context.py`
- `translation/services/context/models.py` -> `translation/core/context/models.py`
- `translation/services/context/unit_context.py` -> `translation/core/context/unit_context.py`
- `translation/services/terms/glossary.py` -> `translation/core/terms/glossary.py`
- `translation/services/terms/abbreviations.py` -> `translation/core/terms/abbreviations.py`
- `translation/services/terms/injection.py` -> `translation/core/terms/injection.py`
- `translation/services/quality/checks.py` -> `translation/llm/validation/quality.py`

These shims have already exited the mainline. Architecture gate rejects continued references to these old paths; new code should reference real paths directly.

### payload/parts boundaries

core/payload/ only retains payload contract and data operations.

- manifest.py is responsible for translation manifest read/write protocol.
- `ops.py` General payload Field read/write.
- `translations.py` Responsible for translation result backfill and status fields.
- formula_protection.py is responsible for payload internal formula protection markers.
- `template_contract.py`、`template_records.py`、`template_sync.py` Template Owner contractRecord and sync.
- parts/ is responsible for payload pure data processing after internal split, e.g., apply, result entry, group split, result status, summary, translation units.

Policy-related mutation/check/default migrated to services/policy/payload_rules/, unified policy status writes to
`core/payload/parts/policy_state.py`runtime policy determination at `services/policy/verdict.py`：

- policy_mutations.py, legacy_policy_mutations.py are responsible for policy stage write fields.
- policy_defaults.py is responsible for reset-phase foundational/default translatable determination.
- legacy_policy_checks.py is responsible for legacy policy CJK, referenced entries, mixed literal pure determination.
- `core/payload/parts/policy_state.py` Responsible `classification_label`、`should_translate`、
  `skip_reason`、`final_status`。
- `services/policy/verdict.py` Unified responses for: model invocation, original text retention, export blocking.

Forbidden directions:

- `llm/providers/**` Should not import `workflow`、`runtime.pipeline`、`rendering`。
- policy/** should not import llm/providers or runtime.pipeline.
- payload/** should not import llm/providers, workflow, rendering.
- memory/** should not import llm/providers, workflow, rendering.
- `translation/**` Overall should not import `services.rendering`。

These rules are `backend/scripts/devtools/check_pipeline_architecture.py` Tighten gradually. Block new out-of-bounds dependencies for now; legacy compatibility entry points will be migrated in batches.

Architecture gate coverage:

- translation Root directory permits only package initialization and README, no new root-level large files allowed
- Production external directories only use translation contracts via services.translation.public
- public/ must remain lazy export, avoiding eager import that launches workflow/rendering
- Deleted shim Path no longer referenceable.
- translation Internal: do not use directly. import `runtime.pipeline`
- Translation should not directly import services.rendering as a whole; the only narrow exception is workflow/execution_runner.py's render source prewarm

## Main flow

1. `core/ocr/` Read unified middleware layer. `document.v1.json` and extract page blocks
2. If the entry is provider raw JSON, first convert via document_schema/adapters.py to document.v1
3. `workflow/translation_workflow.py` Generate and load per-page translation template. payload
4. `core/orchestration` Complete layout area and orchestration metadata.
5. `services/continuation` Consume upstream first. `continuation_hint`Use rules as fallback. Merge consecutive paragraphs into unified. translation unit
6. `services/policy` Skip blocks based on mode.
7. llm handles batch model translation, cache, retry, placeholder/segment/fallback control in a unified way → skipped: complex logic, add when needed.
8. `core/payload` fill the translation results back into page payload, and save the final JSON

Supplementary conventions:

- Translation main thread must not directly interpret any OCR provider raw JSON structure
- translation Default disk result for main branch is "page-by-page". translation payload + translation-manifest.json;"Layer handles artifact content mapping protocol. Final delivery handled elsewhere." PDF File Names & Rendering Modes
- `document.v1` All already brought inside. `skip_translation` tag block must be at `core/ocr/json_extractor.py` Blocked at extraction stage; must not leak into translation candidates.
- abstract and similar body extension semantics may proceed into translation; reference_entry, formula_number and other provider-explicitly skipped blocks must not enter payload.
- Extraction phase: read explicit first. `content.kind / layout_role / semantic_role / structure_role / policy.translate`Default main chain no longer from `derived.role / sub_type / raw_type / tags` Infer the main text.
- Extraction phase will expand continuation_hint on blocks into payload ocr_continuation_* fields
- continuation Currently used provider-first Strategy: prioritize consuming same page. `intra_page` provider hintacross pages `cross_page` hint Only on adjacent pages + order is clear + layout_zone Page footer reached/Top reading boundary + Controlled consumption when sufficient length; otherwise retain but not drive concatenation directly.
- If you only want to troubleshoot. OCR Standardization issues? Check first. `document.v1.report.json`
- Python Side read report Prefer when summarizing. `document_schema/reporting.py`

Default body whitelist now fixed to:

- `content.kind == "text"`
- And policy.translate == true

"This means:"

- Whether the body enters the translation chain should be normalize / adapter Phase Decision
- translation Default main chain: no re-guess. `footer/header/page_number/table/image/code/reference_content`
- `ref_text`、`mixed_literal`、`metadata_fragment` such old local skip / rewrite The rules have already been removed from the default main chain

## Glossary v1

Current glossary pipeline consists of two input layers.

- Glossary resource: by Rust API Save to DB first, then pass. `glossary_id` Quote
- In-task inline terminology: passed directly with the task via glossary_entries

Before entering Python, Rust side completes first:

- Term entry normalization
- Deduplicate
- Naming Terminology Glossary and inline Term merging
- Same source coverage statistics

Translation Current stage: only two things.

- Inject the merged glossary into LLM control context as translation preference hints
- After translation, count term hits and write to translation-manifest.json, diagnostic files, and pipeline summary

Runtime injection rules:

- Before LLM call, based on current item or batch's source text match terms, only matched glossary entries are written into prompt
- Match abbreviations against source before injection. Avoids irrelevant abbreviations polluting current paragraph.
- `preserve` / `canonical` Hard terms apply only to matched source segments; do not perform unconditional full-book replacement.
- If source does not match a term or abbreviation, entry not included in current. promptnor will it affect the current cache. key

Clearly not doing:

- Force-replace after translation.
- No guarantee that every term will be matched
- Do not parse Excel files directly

## Agent v1

Current agent is not a standalone process, not a new provider gateway, but a translation role capability encapsulation in the service layer. They reuse existing
`llm/shared/provider_runtime.py`do not bypass existing modelsbase_url、api_key and Structured Output Protocol.

Implemented roles:

- `TerminologyAgent`
  Provide source text for translation. prompt。
- `ConsistencyReviewerAgent`
  Perform rule-based quality checks on translation output, e.g., untranslated English remnants.placeholder inconsistency, missing terms.
- `RepairAgent`
  Construct for Repairable Issues LLM repair task, only repair current item, do not expand context.
- `TranslationAgentRuntime`
Unified execution of LLM agent tasks, defaulting to active provider's request_chat_content.
- `TranslationAgentCoordinator`
  As the service layer orchestration entry, take terminology/review/repair Stabilize interface.

V1 boundary.

- agent Can be constructed. taskRun taskParse result write diagnostic review artifact
- agent Do not read directly OCR File, does not determine page-level. workflowNo final write. PDF
- Agent has no new SDK dependencies; when adding a new provider, still first connect via llm/shared/provider_registry.py
- multi- agent Orchestration stays. translation Internal, External API Expose only stable artifacts and diagnostics.

Current main link access:

- Translation batch and mojibake fix done. Enter. `agent_repair` Post-processing
- Default RETAIN_TRANSLATION_REPAIR_PROFILE=fast, agent repair has small budget for fallback fixes only; avoid a few abnormal paragraphs slowing the whole book.
- `fast` Default max repairs 8 Few candidates shrink by untranslated count.
- `quality` Enlarges agent repair Budget, suitable for quality-focused offline tasks.
- Passable `RETAIN_TRANSLATION_AGENT_REPAIR_LIMIT=0` Force Close
- Can set RETAIN_TRANSLATION_AGENT_REPAIR=0 to skip agent repair stage
- Fix only repairable issues such as English remnants, missing terminology, and protocol shells.
- placeholder Qty/Hard errors only. Syntax issues reported. Fix: skip diagnose, not let repair agent guess

repair profile：

- `RETAIN_TRANSLATION_REPAIR_PROFILE=fast`
  default mode. Skip heavy garbled reconstruction, retain small budget agent repair Final empty translation closure.
- `RETAIN_TRANSLATION_REPAIR_PROFILE=quality`
  Quality first. Enable larger. agent repair and final recovery budget, suitable for tasks not sensitive to speed.
- Single item coverage:
  `RETAIN_TRANSLATION_GARBLED_RECONSTRUCTION=1`
  `RETAIN_TRANSLATION_AGENT_REPAIR=0|1`
  `RETAIN_TRANSLATION_AGENT_REPAIR_LIMIT=N`
  `RETAIN_TRANSLATION_FINAL_RECOVERY_MAX_ITEMS=N`

Next steps order:

1. First, consolidate more existing "post-translation check / Fix / Term injection funneled into coordinator。
2. Make failure retry, English residue repair, and terminology consistency repair configurable. pipeline。
3. Finally consider cross-paragraph consistency. agent Or document-level term memory. agentAvoid large changes to main flow initially.

## Concurrency and failure scheduling

- DeepSeek official API default translation workers parsed by Rust API as 1000; request body translation.workers can still override.
- Python HTTP Connection pool will by `configured_workers` Zoom, default maximum `1000`Available `RETAIN_TRANSLATION_HTTP_POOL_MAX` Temporary compression active.
- Main translation channel only performs 1 times HTTP attempt。timeout、429、5xxConnection errors release resources immediately. workerNavigate to footer. transport retry Queue prevents one failure from blocking subsequent items.
- Tail transport retry executes after main queue; enabled by default, 2 HTTP attempts, and uses longer timeout.

## Mode description

- `fast`
  Disable classifier.
- `sci`
  For papers and technical documents, it also performs domain inference.
- `precise`
  Enabled. Send source. LLM Classifier: suspicious only. OCR Block does extra checks.

## Policy Config Compatibility notes

services/policy/config.py's build_translation_policy_config() retains several old fields, but they are no longer part of default main-chain semantics:

- `enable_narrow_body_noise_skip`
- `enable_metadata_fragment_skip`
- `metadata_fragment_max_page_idx`
- `enable_reference_zone_skip`
- `enable_reference_tail_skip`

Current convention is:

- Default main chain does not consume these fields to rebuild old skip logic
- Currently only used as deprecated compatibility surface Keep, primarily to avoid old tests./Legacy callers error immediately.
- New code must not base behavior on these fields.

Note:

- Internal Python translation policy contract, not external HTTP API contract
- The actual primary decision of whether to translate should still come from `document.v1` Explicit block policy

## Collaboration rules

If the translation module is maintained separately, this part is only responsible for "turning `document.v1.json` become a stable translation output".

- Edit policies, concurrency, glossary, LLM scheduling, payload disk write, and translation diagnostics here
- Do not process here directly. provider raw OCR structure, nor source PDF Reintegrate rendering logic.
- The current active stage also appears in translation payload + `translation-manifest.json`Render layer consume only this protocol
- If modifying payload structure, manifest field semantics, or default file discovery method, must synchronously update runtime/pipeline, rendering, README, and tests
- The glossary is currently a translation prompt constraint, not a rendering-layer rule, nor... OCR Layer rules; do not leak term logic to other modules.
