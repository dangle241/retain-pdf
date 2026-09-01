# 02 Field Mapping

## Core principles

When mapping, only ask one thing:

- Which layer of document.v1 should this Paddle field map to?

Currently allowed placement layers:

1. Core structure layer:`type/sub_type/bbox/text/lines/segments/tags/derived`
2. Common trace layer: shared metadata that may be supplied by multiple providers
3. Provider raw trace layer: Paddle private fields, kept in metadata/source

## Top-level mapping

| Paddle field | document.v1 field | Description |
| --- | --- | --- |
| provider fixed value | `source.provider` | Currently set to `paddle` |
| Enter file path | source.raw_files.source_json | Injected by adapter from outside |
| Page count | page_count | Confirmed by pages |

## Page mapping

| Paddle field | document.v1 field | Description |
| --- | --- | --- |
| `dataInfo.pages[i].width` | `pages[i].width` | Preferred |
| dataInfo.pages[i].height | pages[i].height | Preferred |
| `prunedResult.width` | `pages[i].width` | Fallback |
| prunedResult.height | pages[i].height | Fallback |
| Page number | pages[i].page_index | Starts from 0 |
| Fixed value | pages[i].unit | Currently fixed to pt |

## Block mapping

| Paddle field | document.v1 field | Description |
| --- | --- | --- |
| block_bbox | bbox | Normalized bbox |
| `block_content` | `text` | Normalize Text |
| block_label | type/sub_type/tags | Uses block_labels.py |
| Lines/Segmentation result | lines/segments | Uses content_extract.py |
| `block_id` | `source.raw_block_id` | Keep original source |
| `block_label` | `source.raw_type` | Preserve original type |
| block_bbox | source.raw_bbox | Keep original bbox |
| `block_content[:200]` | `source.raw_text_excerpt` | Troubleshooting |
| Original path | source.raw_path | Link to original JSON path |

## Current label mapping

Current main rules see:

- `backend/scripts/services/document_schema/provider_adapters/paddle/block_labels.py`

Implemented mapping example:

| `block_label` | `type` | `sub_type` | `tags` |
| --- | --- | --- | --- |
| `doc_title` | `text` | `title` | `title` |
| `abstract` | `text` | `abstract` | `abstract` |
| `text` | `text` | `body` | empty |
| `paragraph_title` | `text` | `heading` | `heading` |
| `reference_content` | `text` | `reference_entry` | `reference_entry, reference_zone, skip_translation` |
| `formula_number` | `text` | `formula_number` | `formula_number, skip_translation` |
| `table` | `table` | `table_html` | `table` |
| `image` | `image` | `image_body` | `image, skip_translation` |
| `algorithm` | `code` | `code_block` | `code` |
| `display_formula` | `formula` | `display_formula` | `formula` |

## derived mapping

Current derived is mainly composed of provider-generated rules, see:

- `backend/scripts/services/document_schema/provider_adapters/paddle/trace.py`

Typical rules:

- `doc_title -> derived.role = title`
- `abstract -> derived.role = abstract`
- `reference_content -> derived.role = reference_entry`
- `formula_number -> derived.role = formula_number`
- `header/footer -> derived.role = header/footer`

## Do not do this

1. Don't directly pack Paddle private fields into new main contract fields.
2. Do not translation layer to re-interpret `block_label`。
3. Don't add dependency for single use. fixture Temporary change `type/sub_type` Semantics.
