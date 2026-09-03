Document Schema description

`scripts/services/document_schema/` Define unified intermediate document structure.

Currently in production:

- schema Name:`normalized_document_v1`
- schema Version:`1.1`
- Default filename:`document.v1.json`
- Default report filename:`document.v1.report.json`
- Machine-readable schema：`document.v1.schema.json`
- Python Validator:`validator.py`

This JSON is the standardized OCR input for translation/main rendering pipeline.

## Stage boundary

`document_schema` This layer only handles OCR / Normalize Phase handoff: no translation or rendering responsibilities to downstream.

Formal input and output fixed as:

Input:
Provider raw OCR payload, provider raw file directories, source PDF required context.
Output:
`document.v1.json` and `document.v1.report.json`.

Not responsible for:

- Understood.
Not responsible for layout overlay, Typst compilation, and final PDF output.
- Not expose downstream stages provider Private fields as primary contract

Stable handoff point:

- OCR Stage end: downstream depends only on. `document.v1.json`
- `document.v1.report.json` Used only for validation, troubleshooting, and compatibility summaries; not for translation/Main Render Input
- provider raw trace Keep for rollback, but do not convert. translation / rendering Main logic depends on external service.

## Field hierarchy specification

`document.v1` Fields herein no longer a hodgepodge. Current convention: three layers.

1. Core Structure Layer
General trace layer
Provider raw trace layer

### 1. Core structural layer

This layer provides stable fields that translation, rendering, and strategy code can directly depend on.

Top level:

- `schema`
- `schema_version`
- `document_id`
- `doc_id`
- `source.provider`
- `page_count`
- `pages`
- `assets`
- `derived`
- `markers`

Page-level:

- `page`
- `page_index`
- `width`
- `height`
- `unit`
- `blocks`

Block-level:

- `block_id`
- `page_index`
- `order`
- `reading_order`
- `geometry`
- `content`
- `layout_role`
- `semantic_role`
- `structure_role`
- `policy`
- `provenance`
- `type`
- `sub_type`
- `bbox`
- `text`
- `lines`
- `segments`
- `tags`
- `derived`
- `continuation_hint`

Principle:

- Downstream main logic read-only layer first.
When integrating new provider, primary goal is to preserve original JSON and stabilize mapping to this layer first.
- Prioritize new primary link consumption. `geometry/content/layout_role/semantic_role/structure_role/policy/provenance`
- old `type/sub_type/bbox/text/lines/segments` Kept as compatibility layer. No further semantic expansion.
- Default translation chain should no longer start from `type/sub_type/tags/derived/source.raw_*` Reverse engineer body text
- `policy.translate` Formal entry point for main text entering translation chain.

`content` Internal layout flow fields:

- `content.text`Block text retain. provider Remove unnecessary newline.
- `content.line_texts`Fetch lines from block. Parse text. List items. provider Explicit line break or adapter Constructed Stability Record
`content.text_flow` downstream formatting contract: current value `flow` or `preserve_lines`.

`text_flow` responsibility boundary of:

- `flow` Represents normal body text; translation and rendering may be streamed by natural paragraphs, and should not be forcibly preserved. OCR Visual line break
- `preserve_lines` Block line structure semantically meaningful: table of contents, numbered lists, bullet lists, structured short-line blocks.
- `preserve_lines` The determination must be at normalize / adapter Layer complete. Rendering layer consumes only contract. No regex re-guessing list structure.
- Paddle etc. provider If only given `block_label=text`Code redundant. Remove. `block_content` Stable explicit line breaks already exist.adapter Upgrade these line breaks to `line_texts + text_flow`, rather than exposing the provider's private fields to downstream consumers. provider expose private fields to downstream

General trace layer

This layer is not a hard dependency on the main path, but multiple... provider It is recommended to align with this set of fields.

Existing fields available for continued use include:

- `content_is_rich`
- `content_format`
- `content_length`
- `content_line_count`
- `asset_key`
- `asset_url`
- `asset_resolved`
- `markdown_match_text`
- `markdown_match_found`
- `markdown_match_count`

Principle:

- This layer mainly serves troubleshooting, tuning, and future enhancements.
- May be read cautiously by policy code.
- Should not replace `type/sub_type/tags/derived`

Provider raw trace layer

This layer is for tracing and debugging only. Downstream business logic must not directly depend on it.

Including but not limited to:

- `source.raw_*`
- `metadata.raw_*`
- `layout_det_*`
- provider Original id/path/score/label
Paddle's `model_settings`.
Paddle's `layout_det_res`.
Paddle's raw `markdown.images`.
Other provider original detection fields.

Principle:

- This layer can be fully retained.
- But should not be treated as the unified semantic entry point.
- If a field is later used by multiple provider Provide stable service, then consider upgrading to "General". trace Layer

### Downstream read principles

Recommended order:

1. Read core structure layer first.
Read general trace layer when necessary.
Only troubleshoot or research provider raw trace layer.

That is:

Translation/main rendering pipeline prefers `geometry/content/layout_role/semantic_role/structure_role/policy/provenance`.
- Read cautiously if enhanced judgment needed. `content_format` Generic trace
- Do not base directly on `layout_det_score`、`source.raw_type`、`metadata.raw_*` Missing context. Provide requirements, language, and existing code.

## Design Goals

Isolate upstream OCR provider original structure in adapter layer.
- Translation, Rendering, StrategyAPI Stable middleware contract
- Avoid over-engineering; do not OCR Semantics hard to stably determine are forced into the main type system.

## Current chain

Main chain agreement

1. Upstream provider Output your own raw result first.
2. adapter convert the raw result to `normalized_document_v1`
`services/translation` and `services/rendering` work only around this unified structure.

Use current provider Implementation example:

Raw OCR: `ocr/unpacked/layout.json`.
- Unified Middleware Layer:`ocr/normalized/document.v1.json`
- Normalization Report:`ocr/normalized/document.v1.report.json`
Stage spec: `specs/normalize.spec.json` (`normalize.stage.v1`).

Note:

Raw `layout.json` reserved for adapter, debugging, and traceback.
Translation/main rendering pipeline consumes `document.v1.json` first.
`document.v1.report.json` for querying adapter detection, default value population, and schema validation summary.
Rust main workflow normalize worker now requires `--spec <job_root/specs/normalize.spec.json>`.
- If only local manual verification. schema / adapter, should go through `scripts/entrypoints/validate_document_schema.py`

Adapter conventions

Provider raw OCR does not go directly to translation/render mainline.

Unified entry at:

- `services/document_schema/adapters.py`

Current adapter interface:

- `detect_ocr_provider(payload)`
- `adapt_payload_to_document_v1(...)`
- `adapt_payload_to_document_v1_with_report(...)`
- `adapt_path_to_document_v1(...)`
- `adapt_path_to_document_v1_with_report(...)`
- `register_ocr_adapter(...)`

Shared Conventions:

- `services/document_schema/providers.py`
  Stable OCR provider Identifier constants,adapter、fixture registryregression scripts prioritize sharing this layer
- `services/pipeline_shared/`
Shared main branch: `pipeline_summary.json`, stdout labels, JSON IO, and source-json selection rules.
- `services/mineru/contracts.py`
  Keep only MinerU provider Private original file name and directory name conventions

Current official provider adapters:

- `mineru -> document.v1`
- `mineru_content_list_v2 -> document.v1`
- `generic_flat_ocr -> document.v1`
- `paddle -> document.v1`

## Provider Adapter Layering

Current adapter Divide into two layers:

1. Common skeleton
2. provider Assembly layer

Generic skeleton located at:

- `services/document_schema/provider_adapters/common/`

Currently contains:

- `document_builder.py`
  Unified top-level assembly. `document.v1`
- `page_builder.py`
  Responsible for unified assembly. page record
- `block_builder.py`
Responsible for unified assembly of block records.
- `normalize.py`
Responsible for general normalization helpers like `bbox/polygon/segments/lines`.
- `relations.py`
  Provides intra-page relation skeleton inferring current block semantics from previous anchor.
- `specs.py`
  Definition provider Internally, first lands to the intermediate. block/page spec

Principle:

- `common/` Do not read a specific OCR provider original field name
- `common/` Only accept already provider Parsed intermediate. spec
- Enables future integration with new systems. OCR, only need to convert the raw JSON convert to specthen pass to general. builder

provider Assembly layer:

- `services/document_schema/provider_adapters/`

Among them:

- `paddle/`
Use directory-based splitting; responsible for translating Paddle raw `layoutParsingResults` to generic spec.
  Currently subdivided into reader、relations、page trace、rich-content trace。
  now reader Pass through within layer. page/block context Consolidate interfaces. Stop scattered passing. markdown/layout trace Parameters.
- `mineru_content_list_v2_adapter.py`
  General integration complete. builderbut not yet like Paddle Same directory structure
- `generic_flat_ocr_adapter.py`
  Still the thinnest layer. passthrough adapter
- `mineru`
  Main branch still active `services/mineru/document_v1.py`Not in current generalization round.

That is, future extensions. OCR provider When, the priority is not to continue piling up 'big' adapter file content

Provider raw JSON -> provider internal spec.
2. spec -> `common` builder
3. adapter Register to `adapters.py`
4. fixture Integration Regression

Paddle current rich-content trace split into three layers:

- Content Profile`content_profile.py`
- References:`asset_links.py`
- markdown Fuzzy match:`markdown_match.py`

`rich_content.py` Keep only aggregation entry; remove specific parsing details.

Note:

Paddle's `content_format / asset_* / markdown_match_*` currently categorized under general trace layer.
Paddle's `layout_det_* / model_settings / markdown.images` currently categorized under provider raw trace layer.

New provider reference:

- `services/document_schema/provider_adapters/provider_adapter_template.py`
- `services/document_schema/provider_adapters/paddle/`

Future additions OCR provider When, the correct approach is:

1. Add a new provider adapter
Convert raw JSON to `normalized_document_v1`.
Immediately after adapter output, run schema validation.
4. Downstream continue only consume. `document.v1.json`

Recommended integration order:

1. First clarify field placement rules.
First decide which fields go to `content/layout_role/semantic_role/structure_role/policy`, which stay in `tags/derived`, and which in `metadata/source`.
Prepare minimal raw fixture.
Place in `scripts/devtools/tests/document_schema/fixtures/`.
3. Write and register adapter
   Prioritize reusing `providers.py` Sharing provider Constants, do not use. adapter、fixture...raw strings in adapters, fixtures, or regression entries.
   If original structure complex, prioritize by `payload_reader / block_labels / relations / content_extract / trace` This kind of responsibility splitting, rather than continuing to pile up single files.
Register fixture to `fixtures/registry.py`.
Run `regression_check.py`.
   let detector、adapt、validation、extractor smoke pass in one go.

## Check entry point

Long-term check entry:

- `scripts/entrypoints/validate_document_schema.py`
- `scripts/devtools/tests/document_schema/regression_check.py`

Now supports two usage modes:

1. Directly validate already generated. `document.v1.json`
Run `adapter -> defaults -> validation` on raw OCR JSON and output report.

Example:

```bash
python scripts/entrypoints/validate_document_schema.py output/.../ocr/normalized/document.v1.json
python scripts/entrypoints/validate_document_schema.py output/.../ocr/unpacked/layout.json --adapt --document-id demo --write-report /tmp/document-schema-report.json
```

report Currently includes:

- Enter path
- adapter/provider Detection Results
- Default value completion statistics
Schema validation summary.

`validate_document_schema.py --write-report` Current convention:

- `mode = "adapt"` Time:
  - `input_path`
  - `normalization`
  - `normalization_summary`
  - `validation`
When `mode = "validate"`:
  - `input_path`
  - `validation`

That is:

- For adapter, defaults, and detection details see `normalization`
- Stable lightweight summary first. `normalization_summary`
- View top-level validation results. `validation`

Unified consumption entry:

- `services/document_schema/reporting.py`
- `load_normalization_report(path)`
- `build_normalization_summary(report)`

Conventions:

- Python If the side just wants to display provider / detected provider / pages observed / blocks observed / defaulted field counts / validation Summary, prioritize these two. helper
Do not rewrite each layer individually in `mineru/summary.py`, debug script, or follow-up API with `report['defaults']['pages_seen']` etc.
- needs complete original report Then use directly. report dictItself does not prevent retaining original fields.

Regression smoke Check:

```bash
python scripts/devtools/tests/document_schema/regression_check.py
python scripts/devtools/tests/document_schema/regression_check.py --write-report /tmp/document-schema-regression.json
```

This regression script now performs hard validation instead of simple logging:

- adapter The registry must contain the current official version. provider
Current `document.v1.json` must pass schema validation.
Raw layout / `content_list_v2.json` / generic fixture / paddle fixture must all be auto-detected, adapted, and pass schema validation.
- Explicitly specify provider The path must also be usable, to prevent automatic detection passing while explicit invocation degrades.
Providers like Paddle need additional semantic assertions; at least lock down:
  - `header/footer`
  - `image_caption/table_caption`
  - `table_footnote`
  - `display_formula -> formula segment`

Suggestion:

Add at least one provider semantic assertion; don't only check `pages / blocks`, otherwise classification regression easily missed.
- Don't only look. `pages / blocks`otherwise classification regression is easily missed.

## Default value fill rules.

adapter current version produced `document.v1.json` Before main flow, uniformly apply stable defaults.

### Hard field

These fields cannot be auto-guessed; missing fields are structural errors:

- Document-level:
  - `schema`
  - `schema_version`
  - `document_id`
  - `source`
  - `pages`
Page-level:
  - `width`
  - `height`
  - `unit`
  - `blocks`
- block Level:
  - `block_id`
  - `geometry`
  - `content`
  - `layout_role`
  - `semantic_role`
  - `structure_role`
  - `policy`
  - `provenance`

### Soft Fields

These fields allow the default value convergence layer to fill default values:

Document-level:
  - `derived -> {}`
  - `markers -> {}`
  - `page_count -> len(pages)`
Page-level:
  - `page_index -> Current page number`
Block-level:
`page_index -> current page index`.
  - `order -> Current block order`
  - `reading_order -> order`
  - `geometry -> {bbox:[0,0,0,0]}`
  - `content -> {kind:\"unknown\", text:\"\"}`
  - `layout_role -> \"unknown\"`
  - `semantic_role -> \"unknown\"`
  - `structure_role -> \"\"`
  - `policy -> {translate:false, translate_reason:\"missing_contract_fields\"}`
  - `provenance -> {provider:\"\", raw_label:\"\", raw_sub_type:\"\", raw_bbox:[0,0,0,0], raw_path:\"\"}`
  - `tags -> []`
  - `derived -> {role:\"\", by:\"\", confidence:0.0}`
  - `continuation_hint -> {source:\"\", group_id:\"\", role:\"\", scope:\"\", reading_order:-1, confidence:0.0}`
  - `metadata -> {}`
  - `source -> {}`

Principle:

- Default value consolidation layer only populates fields with clearly defined stable defaults.
Default value consolidation layer only fills vacant slots; official semantic definition still gated by `contract_v1.py`.
- Real structural errors still handed over to validator Block

## Top-level structure

Top-level fields:

- `schema: str`
  Fixed to `normalized_document_v1`
- `schema_version: str`
  The current latest version is `1.1`
  validator Accept current version only. `1.1`
- `document_id: str`
  Document identifier, usually corresponds to job Or enter document
- `source: dict`
  Record top-level source information. provider and original file
- `page_count: int`
  Page Count
- `pages: list[dict]`
Page list.
- `derived: dict`
  Document-level derivation notes or post-processing remarks
- `markers: dict`
  Document-level stable marker, e.g., reference start point.

Example:

```json
{
  "schema": "normalized_document_v1",
  "schema_version": "1.1",
  "document_id": "20260330145544-14ab20",
  "source": {},
  "page_count": 1,
  "pages": [],
  "derived": {},
  "markers": {}
}
```

## Page Structure

Each page object currently contains:

- `page_index: int`
Starts from `0`.
- `width: number`
  Page width
- `height: number`
  Page height
- `unit: str`
  In use `pt`
- `blocks: list[dict]`
  Page Blocks

Constraints:

- `pages[i].page_index` Match array order.
- `blocks` Order of inner blocks determined by `order` Specify explicitly

## Block Structure

Each block currently contains:

- `block_id: str`
Stable block ID, e.g., `p001-b0000`.
- `page_index: int`
  Current page
- `order: int`
  In-page order
- `reading_order: int`
  Normalized Reading Order
- `geometry: dict`
  Stable geometry field, currently contains at least `bbox`
- `content: dict`
Stable content fields, currently at least `kind` and `text`.
- `layout_role: str`
  Explicit layout role
- `semantic_role: str`
  Explicit semantic roles
- `structure_role: str`
  Explicit body structure role
- `policy: dict`
  Explicit execution policy, currently includes at least `translate`
- `provenance: dict`
  provider Original Tags and Traceback Information
- `type: str`
  Main type compatible
- `sub_type: str`
  Compatible Subtypes
- `bbox: [x0, y0, x1, y1]`
  Compatible with block-level bounding boxes.
- `text: str`
  Normalized Plain Text for Blocks
- `lines: list[dict]`
  Row-level structure
- `segments: list[dict]`
  span/segment Flat structure
- `tags: list[str]`
  Lightweight Derived Tag
- `derived: dict`
  stronger derived semantic conclusions
- `continuation_hint: dict`
  provider Or upstream structural layer paragraph continuity hint.
- `metadata: dict`
Debug/mapping metadata.
- `source: dict`
  provider Original source information

`continuation_hint` conventions

`continuation_hint` is a block-level stable field to accept hints from OCR provider or structural layer that these blocks belong to same paragraph.

Current field:

- `source`
  Retained `"" | "provider"`
- `group_id`
  Same consecutive group stability. id
- `role`
  `"" | "single" | "head" | "middle" | "tail"`
- `scope`
  `"" | "intra_page" | "cross_page"`
- `reading_order`
  provider Reading order within the given group; when unknown. `-1`
- `confidence`
  `0.0 ~ 1.0`

Current behavior constraints:

- `document.v1` Only responsible for reliably writing the prompt to disk, not in schema Layer hardcodes something. provider Private fields
Translation current branch consumes `source="provider"` and `scope="intra_page"` hints first.
- `cross_page` hints are only translation Layers satisfy adjacent pages, order clear.layout zone Consume under controlled conditions such as boundary security and sufficient text length;schema Layer only defines and persists contracts.
If new OCR provider can stably produce continuation group info, write this field preferentially, not expose private raw fields downstream.

`type / sub_type` conventions

`type / sub_type` Only stable structures; no forced insertion. OCR High-level semantics hard to reliably determine.

Current primary type:

- `text`
- `formula`
- `image`
- `table`
- `code`
- `unknown`

Used `sub_type` examples:

- `title`
- `body`
- `metadata`
- `header`
- `footer`
- `page_number`
- `footnote`
- `display_formula`
- `figure`
- `table_body`
- `code_block`

Rule:

- Prioritize stable-mapping structures. `type / sub_type`
- Unstable high-level semantics. Do not expand main type system directly.
- First ask: "Is this structural or semantic judgment?"
- First ask "across provider Are they all highly likely to land stably?

Example:

- Body paragraph:
  - `type = "text"`
  - `sub_type = "body"`
- Header:
  - `type = "text"`
  - `sub_type = "header"`
- display formula:
  - `type = "formula"`
  - `sub_type = "display_formula"`
- Code block:
  - `type = "code"`
  - `sub_type = "code_block"`
- OCR Cannot stably segment, but can confirm it is text:
  - `type = "text"`
`sub_type = "metadata"` or `body`.

Counterexample:

Do not directly insert `caption` into `type`.
Do not directly put `reference_entry` into `sub_type`.
- Don't add dependency for single use. provider If special fields exist, add a new primary type.

connect provider Judge according to the following:

- `text/header/footer/page_number/footnote` such layout structures are stable, enter `type / sub_type`
- `formula/display_formula`、`image/figure`、`table/table_body`、`code/code_block` This type of block-level structure is stable, proceed. `type / sub_type`
- `image_caption/table_caption/table_footnote/reference_entry/reference_heading` This type is more like "semantic tags"; prioritize. `tags`
- If local rules or subsequent LLM Stronger conclusion reached for a section; now write it in. `derived.role`
Fields like `author/date/affiliation/doi` are often unstable across OCR providers; do not default create new stable `sub_type` entries.

`tags / markers / derived` layering

This is current. schema Most important design convention.

### `tags`

`tags` Block-level lightweight markup.

Suitable for:

- `caption`
- `image_caption`
- `table_caption`
- `table_footnote`
- `image_footnote`
- `reference_heading`
- `reference_entry`
- `reference_zone`

Features:

- lightweight
- Side-by-side.
- Rapid rule consumption

Fit into `tags` examples:

- Block is both `caption`and can be further subdivided into `image_caption`
- Reference block already in. Extra label redundant. Remove. `reference_zone`

Examples not suitable for `tags`:

- Body text / Header / Footer and other stable components.
- provider Temporary debug field

### `markers`

`markers` Document-level stable marker.

In use:

- `reference_start`

Example:

```json
{
  "reference_start": {
    "page_index": 10,
    "block_id": "p011-b0021",
    "order": 21
  }
}
```

Examples suitable for markers:

- Document-level. `reference_start`

Examples not suitable for markers:

- Single block semantics
- Debug info temporarily relevant only to a specific page.

### `derived`

`derived` This is a stronger derived semantic conclusion.

Block-level `derived` Current structure:

- `role: str`
- `by: str`
- `confidence: float`

For example:

- `role = "caption"`
- `role = "reference_heading"`
- `role = "reference_entry"`

`derived` Meaning:

- Allow provider rule writes
- Allow local rule writes.
- Also allow later LLM writes

In other words,`derived` Main entry point for subsequent semantic layer evolution.

Examples suitable for derived:

- `role = "caption"`
- `role = "reference_heading"`
- `role = "reference_entry"`
- `role = "algorithm"`but only if this conclusion is based on local rules or higher-level judgments, rather than forcibly provider Copy original fields into main contract.

Examples not suitable for derived:

- The provider's original raw_type
- Can be directly and stably applied. `type / sub_type` Structure
- Temporary marker meaningful only to a specific local script.

Practical judgment:

- If downstream logic wants to quickly filter a batch of blocks, prioritize. `tags`
- If downstream logic expects to handle this as an explicit semantic object, prioritize `derived.role`
- If this is the layout ground truth, do not include. `tags/derived`Drop directly `type / sub_type`

## Boundary between metadata and source

### `metadata`

`metadata` Place local mapping, debugging, and structure tracing information.

Currently used examples:

- `raw_index`
- `raw_angle`
- `raw_sub_type`
- `parent_block_id`

Features:

- Prefer local implementation.
- Debug-oriented/tracking
- Unnecessary business logic coupling at upper layers.

### `source`

source holds provider source information.

Currently used examples:

- `provider`
- `raw_page_index`
- `raw_path`
- `raw_type`
- `raw_sub_type`
- `raw_bbox`
- `raw_text_excerpt`

Features:

- Preserve original mapping.
- Traceability provider output
- Should not become translation/Main rendering logic long-term dependencies

## Line and paragraph structure

`lines[*]` Current field:

- `bbox`
- `spans`

lines[*].spans[*] current fields:

- `type`
- `raw_type`
- `text`
- `bbox`
- `score`

segments[*] current fields:

- `type`
- `raw_type`
- `text`
- `bbox`
- `score`

Convention:

- `segments` Flat inline sequence inside block; aids translation and formula protection.
- `lines` Preserve line-level structure for formatting and local analysis.
- Inline formulas not supported. Block primary type retained. In segments/spans

## Stable contract, unstable fields

Current proposal fields considered stable contract:

- Top-level: schema, schema_version, document_id, page_count, pages, markers
- page:`page_index`, `width`, `height`, `unit`, `blocks`
- block：`block_id`, `page_index`, `order`, `type`, `sub_type`, `bbox`, `text`, `lines`, `segments`, `tags`, `derived`, `continuation_hint`, `metadata`, `source`
- `derived.role/by/confidence`

Currently not recommended for external strong binding:

- `metadata` Internals
- `source.raw_*` specific field set
- Some provider-specific tags

In other words:

- Upper services depend first on `type / sub_type / tags / derived / markers`
- Do not revert provider original fields to primary contract.

## Version evolution principles

`v1` Currently available, but not yet the final once-and-for-all version.

Subsequent evolution principles:

- Minor changes: append fields; avoid semantic changes.
- If breaking existing stable contract, upgrade to `v2`
- provider Adapter absorbs upstream changes; does not leak directly to main path.

### Current conclusion

Not recommended to start at this stage. `document.v2`。

Reason:

- The main storyline has just been completed. `raw -> adapter -> defaults -> validator -> document.v1` closing, primary goal is to `v1` Polish stability.
- Most existing new requirements still fall under adapter Extensions,`tags/derived/markers` Semantic accumulation and regression coverage enhancement; not yet at the point of breaking the contract.
- If opened too early `v2`, will provider Bringing in integration, translation mainline, rendering mainline, and historical task compatibility simultaneously yields less benefit than first... `v1` Steady

### Only consider opening if these conditions are met. `v2`

Satisfy at least one category:

1. `v1` Stable field definitions must be replaced in their entirety.
For example:
   - `type / sub_type` System overhaul required.
   - `lines / segments` The basic organizational approach needs to change.
   - `tags / derived / markers` Responsibility boundaries need overall redrawing.

2. Cross-origin error. provider Long-term common requirements, but cannot be expressed compatibly via "adding fields."
For example:
   - Multiple OCR provider all consistently produce a certain type of structure, and `v1` Lossless transfer not possible.
   - Existing field semantics force downstream to continuously write compatibility branches.

3. Legacy compatibility costs now clearly exceed upgrade costs.
For example:
   - Default value consolidation layer increasingly resembles a "half-rewrite."
   - validator And the mainline requires maintaining two conflicting sets of assumptions long-term.

### Default strategy before this

- Expand first adapterdo not extend the main link contract.
- Prioritize supplementing `tags / derived / markers` semantics, do not change easily `type / sub_type`
- Prioritize adding machine-readable schema and regression samples, do not upgrade version number first.

## Current top implementation principle

- Main link prioritize around `document.v1.json`
- adapter Layer Responsibility `raw -> normalized`
- Business layer consume first.
  - `type / sub_type`
  - `tags`
  - `derived`
  - `markers`

Do not use MinerU's original JSON structure as the translation/render main contract.

## Collaboration rules

This layer is OCR Most important protocol boundary with downstream modules.

- document.v1.json is the translation/rendering formal contract for direct dependency.
- `document.v1.report.json` Validation, debugging, compatibility summary — not downstream primary input.
- Add new fields to core structure or common first. trace Layer: do not let downstream have long-term dependencies. raw trace
- If modified `document.v1` Structure, field semantics, or default filename must be updated simultaneously. adapter、README、fixture、schema Checksum and downstream compatibility test
- translation / rendering If the responsible party needs more semantics, define them here first, then implement in respective modules; do not bypass this layer to read directly. provider Private fields
