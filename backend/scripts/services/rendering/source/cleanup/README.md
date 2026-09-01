# rendering/source/cleanup

## Responsibilities

PDF Original page cleanup layer. Operate directly here. PyMuPDF Page object. Handles original text deletion, visual redaction.
Background filling and related diagnostics. It is not responsible. Typst Source code, translation layout,OCR provider Raw data or
Workflow orchestration.

## Stable entry point

External first source layer facade:

- `services.rendering.source.redaction.redact_source_text_areas`
- `services.rendering.source.redaction.redact_translated_text_areas`

cleanup Stable entry point within subpackage:

- redaction.py external redaction entry.
- strategy.py user-visible/configuration layer redaction strategy parsing.
- `routes.py`Dispatch parsed route to execution branch.

Other modules default to implementation details. New calls: depend on concrete modules, not the aggregate. facade。

## Removed legacy compatibility entry point

These old aggregation/compatibility modules removed; callers must switch to concrete implementation modules or source layer primitives:

- `analysis.py`
- `document_ops.py`
- `fill.py`
- `geometry.py`
- `math_protection.py`
- `ops.py`
- `plan.py`
- `route_selection.py`
- `shared.py`
- `text_analysis.py`
- `text_draw.py`
- `text_match.py`
- `vector_analysis.py`

Basic capability location:

- Background fill:`source/background/fill.py`
- Basic Rectangle Tool:`source/rects.py`
- translated item Read:`source/items.py`
- PDF Document operations:`source/document_ops.py`
- dev overlay：`source/dev_overlay/`

## Grouping implemented.

### Text Matching
- `text_matching.py`：item Go to main matching flow for deletable text rectangles.
- text_safe_direct.py: single span and OCR bbox deletion if within threshold → skipped: detailed validation, add when needed.
- `text_ownership.py`Overlap detected. Resolve conflict. bbox Scenario word/span/block Ownership
- `text_math_guard.py`: formula guard filtering and display math Intrusion detection.
- `text_rects.py`：word/block Match results to redaction rect Conversion needed. Determine source format. Identify target format. Execute conversion command. Verify output correctness.
- text_extract.py: PyMuPDF text blocks/spans/words extraction.
- `text_intrusion.py`: Detect short text spans on the page suspected of intruding into display math areas. display math Area large short text span。

### Route And Plan
- auto.py: execution details of the automatic cleanup route; routes.py only does route selection and subsequent distribution.
- valid_items.py: converts translated items to cleanup executable item list.
- `route_decision.py`：redaction route decision Type definition.
- `route_context.py`: From plan/page generate route selection required image/drawing facts。
- route_decider.py: based on route, context, and fill policy, selects specific execution branch.
- `plan_types.py`：`RedactionPlan` Type definitions.
- page_facts.py: collects image page, drawing rects, and drawing count.
- `plan_builder.py`From the page and translated items Constructor `RedactionPlan`。
- `plan_policy.py`: based on plan page-level cover/vector-heavy Judge helper。
- `empty_result.py`Empty redaction Input stability diagnosis result.
- redaction_flow.py: external redaction process orchestration behind the entry point.

### Execution Routes
- standard.py: standard text layer cleanup entry (keep history). monkeypatch/debug entry.
- `standard_policy.py`Standard Route item/page Level policy determination.
- `standard_thresholds.py`Standard route threshold constant.
- standard_execution.py: page-level cover+text cleanup and redaction annotation execution helpers.
- `cover_only.py`Pure overlay for high-draw-count pages.+Text layer cleanup execution branch.
- `image_page.py`Image page cleanup workflow: prepare background overlay, delete text layer, then paste background back.
- `vector_heavy.py`Vector complex page cleanup: overwrite and delete safe-to-clean text layers.
- `visual_cover_execution.py`Visual occlusion route execution. helper, including flat/normal cover Delete optional text layer.
- layer_items.py: based on cleanup item plan, extract visual cover rect and bbox text strip rect.

### Math And Vector Guards
- `math_fonts.py`Special formula font recognition.
- `math_spans.py`From page text span Collection Formula Protection rect Same height as normal text.
- `math_intrusion.py`Check formula protection. rect Intrude into deletable text area?
- vector_overlap.py: calculates overlap count and area ratio between item bbox and page drawing rects.
- `vector_item_policy.py`Based on overlap Statistical Judgment item Is visual masking the only option?

### Legacy / Dev Overlay
- Old text_layer.py / visual_cover.py compatibility wrappers removed; callers must use
  `routes.py` Or specific execution module.
- Old text_draw.py / builders.py compatibility wrappers removed; callers must use
  `source/dev_overlay/`。

## Boundary Rules

- Not supported: source/background/ direct import; background only via source layer facade
or primitive call.
- Do not import from layout/output/workflow reverse layer; only receive source/page/item layer input.
- Understood. No new code. import Compatibility entry; architecture gate blocks. cleanup Internal to these facade Dependencies.
- Basic geometry, item reading, PDF document operations requiring sharing, move up to source/rects.py,
  `source/items.py`、`source/document_ops.py`。
