# 00 Overview

## Goal

Paddle OCR The goal of the integration layer is:

- Input: Paddle OCR raw JSON
- Output: conforming to the current main contract `normalized_document_v1`

That is:

`Paddle raw payload -> provider adapter -> document.v1 -> translation/rendering`

## Current recognition criteria

Current code identifies the following as payload Identified as Paddle：

- Top level is `dict`
- Exists `layoutParsingResults`
- Exists dataInfo

Code location:

- `backend/scripts/services/document_schema/provider_adapters/paddle/adapter.py`
- `backend/scripts/services/document_schema/adapters.py`

## Current directory responsibilities

`provider_adapters/paddle/` Currently split by responsibility into these parts:

- `adapter.py`
Paddle provider total entry
- `payload_reader.py`
  Read top-level payloadand construct by page. page spec
- `page_reader.py`
  Construct page context/page spec
- `block_reader.py`
Construct block context/block spec
- `block_labels.py`
  `block_label -> type/sub_type/tags` Mapping
- `trace.py`
Construct metadata/source/derived
- `continuation.py`
Map Paddle group information to continuation_hint
- `page_trace.py`
Match page-level trace with layout_det
- `rich_content.py` and related files
  Rich content trace Aggregation

## Task boundaries for adapters

When adapting Paddle, only needs to handle these layers:

1. Paddle Original Field Descriptions
2. Field placement rules
3. `block_label` Semantic mapping
4. `continuation_hint` Mapping
5. fixture and regression

Don't mix these into the task.

1. Prompt
2. Layout Override
3. PDF write back
4. Frontend display logic

## Delivery criteria

At least:

1. adapt_path_to_document_v1() can convert Paddle raw JSON to document.v1
2. validate_document_payload() passes
3. `extract_text_items()` smoke through
4. fixture Registered into regression.
5. Document updated.
