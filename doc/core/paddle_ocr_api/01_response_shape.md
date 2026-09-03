# 01 Response Shape

## Top-level structure

Current Paddle adapter top-level dependency fields mainly include:

- `layoutParsingResults`
  Parsed results list by page
- `dataInfo`
  Page size and other metadata
- `preprocessedImages`
  Preprocess image list (optional)

See current minimum recognition criteria:

- `backend/scripts/services/document_schema/provider_adapters/paddle/adapter.py`

## Page-level structure.

For each page, current adapter Main read

- `prunedResult`
- `prunedResult.parsing_res_list`
- `prunedResult.layout_det_res.boxes`
- `markdown.text`
- `markdown.images`

Page size priority order:

1. `dataInfo.pages[i].width / height`
2. `prunedResult.width / height`
3. Defaults to `0`

## block Hierarchy

Current block reader reads these fields:

- `block_label`
- `block_bbox`
- `block_content`
- `block_polygon_points`
- `block_id`
- `group_id`
- `global_block_id`
- `global_group_id`
- `block_order`

Note:

- `block_label` Define main structure mapping
- `block_content` Main text source.
- `group_id / global_group_id / block_order` Primarily serves `continuation_hint`

## Current page construction flow

Current page adapter process:

1. Read one page payload from layoutParsingResults[page_index]
2. Construct PaddlePageContext
3. Construct blockwise block spec from prunedResult.parsing_res_list
4. Supplement Level `metadata`
5. Hand off to common builder to generate document.v1

Entry point:

- `backend/scripts/services/document_schema/provider_adapters/paddle/payload_reader.py`
- `backend/scripts/services/document_schema/provider_adapters/paddle/page_reader.py`

## Documentation maintenance suggestions

If later Paddle API Structure changed. Prioritize updating this file:

1. Top-level field changed?
2. Whether page-level field paths have changed
3. block Level field path changed?
4. Which fields are no longer reliable?
