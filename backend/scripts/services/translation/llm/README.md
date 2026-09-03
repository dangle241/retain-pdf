# LLM Directory conventions

The current directory is split byprovider provider-specific implementations" and "cross- provider Split common logic.

## Newcomers read first

- Want to see provider API Request & Default Model:
  `providers/deepseek/client.py`
- View 'Currently Active' providerUnified runtime entry point
  `shared/provider_runtime.py`
- To see provider registry/capability assembly:
  `shared/provider_registry.py`
- To see provider-side translation implementation:
  `providers/deepseek/translation_client.py`
- Translation control context, terminology, and prompt assembly entry point:
  `shared/control_context.py`
- Want to see translation prompt/message Construct:
  `shared/prompt_building.py`
- Want to see the main translation orchestration and batch retry:
  `shared/orchestration/retrying_translator.py`
- Want to see plain-text Version downgrade required. Check compatibility.placeholder Stability strategy:
  `shared/orchestration/single_item_flow.py`
- View single direct-typst/heavy-formula/tagged-placeholder path runtime does not use
  `shared/orchestration/single_item_routes.py`
- To see fallback facade:
  `shared/orchestration/fallbacks.py`
- Want to see the complete responsibility map of the orchestration directory:
  `shared/orchestration/README.md`
- To see formula clipping window, segment routing:
  `shared/orchestration/segment_routing.py`
- Want to see placeholder validation and degradation reasons:
  `placeholder_guard.py`

## Directory map

- `providers/`
Only place provider-specific API adapters, request/response handling, provider defaults.
  Should not carry cross. provider retry orchestration, common structured parsing rules, page-level workflow、policy Decision.memory State and Rendering/Write to disk.
- `shared/`
  Cross only provider Shared capabilities, e.g., context control, caching, structuring. schema Parser.
- `shared/prompt_building.py`
Unspan provider prompt/message building logic; stop piling up provider transport in the file.
- `shared/provider_runtime.py`
Is the shared layer access to the active provider stable adapter port.
- `shared/provider_registry.py`
Holds provider runtime definition, provider family/default model/base url, and transport/translation capability assembly.
- `shared/provider_protocol.py`
Holds provider runtime protocol types and capability descriptions. When adding new capabilities to a provider, expand here first, then assemble in registry.
- `shared/orchestration/`
Only place cross-provider translation orchestration, fallback, segment routing.
  Priority: rely on existing. `shared/provider_runtime.py`, do not directly import `providers/deepseek/*`。
  Detailed module boundary descriptions within directory: see `shared/orchestration/README.md`。
- Top-level `llm/`
  Now only keep the stable aggregation entry and a small number of top-level common modules.
New code should prefer direct dependencies on `providers/` or `shared/` implementations below.

## Directories

- `providers/deepseek/`
Place DeepSeek-specific API adaptation, defaults, request/response handling
- `shared/`
  Allow Cross-Origin provider caching, context control, structuring schema and parsers
- `shared/prompt_building.py`
Place prompt and message builder
- `shared/provider_runtime.py`
Place shared runtime adaptation layer to current active provider
- `shared/provider_registry.py`
Place active provider registry and capability runtime
- `shared/orchestration/`
Place cross-provider translation orchestration, fallback, segmented formula routing
- Top-level `llm/`
  Keep stable aggregation entry and minimal top-level common logic.

## Current layering

- Provider-specific
  - `providers/deepseek/client.py`
  - `providers/deepseek/translation_client.py`
- shared Common Layer
  - `shared/control_context.py`
  - `shared/cache.py`
  - `shared/prompt_building.py`
  - `shared/provider_registry.py`
  - `shared/provider_runtime.py`
  - `shared/structured_models.py`
  - `shared/structured_output.py`
  - `shared/structured_parsers.py`
- shared Orchestration Layer
  - `shared/orchestration/README.md`
  - `shared/orchestration/retrying_translator.py`
  - `shared/orchestration/single_item_flow.py`
  - `shared/orchestration/single_item_deps.py`
  - `shared/orchestration/single_item_routes.py`
  - `shared/orchestration/fallbacks.py`
  - `shared/orchestration/segment_request.py`
  - `shared/orchestration/segment_windows.py`
  - `shared/orchestration/segment_executor.py`
  - `shared/orchestration/segment_failures.py`
  - `shared/orchestration/batched_plain.py`
  - `shared/orchestration/direct_typst.py`
  - `shared/orchestration/direct_typst_long_text.py`
  - `shared/orchestration/direct_typst_salvage.py`
  - `shared/orchestration/heavy_formula.py`
  - `shared/orchestration/plain_text_validation.py`
  - `shared/orchestration/sentence_level.py`
  - `shared/orchestration/transport.py`
  - `shared/orchestration/keep_origin.py`
  - `shared/orchestration/metadata.py`
  - `shared/orchestration/common.py`
  - `shared/orchestration/segment_routing.py`
- Common logic
  - `placeholder_guard.py`
  - `domain_context.py`

## Stable and compatibility entry points

- Stable Aggregation Entry
  - `llm/__init__.py`
  - `providers/deepseek/__init__.py`
  - `shared/__init__.py`
  - `shared/orchestration/__init__.py`

## Provider Runtime Layering

- `providers/<provider>/`
Only concerned with provider-specific transport, defaults, provider personal translation details.
- `shared/provider_registry.py`
Assembles provider-specific capabilities into `TranslationProviderRuntimeProtocol`
- `shared/provider_runtime.py`
Exposes "current" active provider stable alias for business layer orchestration layer
- Business layer
Default dependency only on `shared/provider_runtime.py`, not directly importing `providers/deepseek/*`

## Critical call chain

- Main translation chain
  `workflow/translation_workflow.py`
  -> `services.translation.llm.translate_batch`
  -> `shared/orchestration/retrying_translator.py`
  -> `shared/orchestration/single_item_flow.py`
  -> `providers/deepseek/translation_client.py`
  -> `providers/deepseek/client.py`
- Domain prompt chain:
  `domain_context.py`
  -> `shared/control_context.py`
  -> `providers/deepseek/client.py`
- Formula fallback chain:
  `shared/orchestration/retrying_translator.py`
  -> `shared/orchestration/segment_routing.py`
  -> `shared/orchestration/single_item_flow.py`
  -> `placeholder_guard.py`

## Troubleshooting entry

- placeholder Errorkeep-origin Downgrade version. Check compatibility. Test thoroughly.
  `placeholder_guard.py`
- Batch retry, single item Downgrade:
  `shared/orchestration/retrying_translator.py`
  `shared/orchestration/single_item_flow.py`
  `shared/orchestration/fallbacks.py`
  `shared/orchestration/README.md`
- Structured output parsing failed:
  `shared/structured_output.py`
  `shared/structured_parsers.py`
- Debugging and replay：
  `backend/scripts/devtools/replay_translation_item.py`
  `backend/scripts/devtools/tests/translation/`

## Subsequent conventions

- When adding a new provider, prioritize adding new implementation in `providers/<provider>/`
- When adding a new provider, simultaneously declare capabilities in `shared/provider_protocol.py` and register runtime in `shared/provider_registry.py`
- Common capabilities first. `shared/`
- Top-level `llm/` keep only stable aggregation entry and few top-level common modules. Stop stacking provider exceptions.
- Business code routed via `shared/provider_runtime.py` Access default modelbase_url、api_key Parsing and General chat transport
