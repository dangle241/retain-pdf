# 03 Semantics Rules

## General Principles

When adapting Paddle, first determine which category the field belongs to:

1. Stable structure
2. Stable Semantics
3. Original (debug only) trace

## Core structure layer includes: data models, core algorithms, essential business logic.

Only cross provider Only content that is also highly stable is allowed into the core structural layer:

- `type`
- `sub_type`
- `bbox`
- `text`
- `lines`
- `segments`
- `tags`
- `derived`
- `continuation_hint`

## Which processes `tags`

`tags` Lightweight, composable structural hints. Downstream-consumable.

Current Paddle examples in use.

- `title`
- `abstract`
- `heading`
- `caption`
- `image_caption`
- `table_caption`
- `reference_zone`
- `skip_translation`
- `image`
- `table`
- `formula`

## What goes into derived

`derived` Place stronger semantic conclusions here. Cite source.

Current format:

```json
{
  "role": "title",
  "by": "provider_rule",
  "confidence": 0.98
}
```

Examples of eligible derived:

- title
- abstract
- reference_entry
- formula_number
- header/footer
- caption/footnote and other provider-identified roles

## Which remain only in `metadata/source`

Paddle private fields should by default be left in the trace layer initially:

- `raw_group_id`
- `raw_global_group_id`
- `raw_global_block_id`
- `raw_block_order`
- `raw_polygon`
- `layout_det_*`
- `model_settings`
- `markdown.images`

Only when multiple provider Only consider upstreaming when all outputs are stable and downstream truly requires it.

## Current trace layering

Current Paddle trace layering suggestions:

1. Core structure layer
2. Common trace layer
3. Provider raw trace layer

Among them:

- content_format / asset_* / markdown_match_* are more generic trace layer items
- `layout_det_* / model_settings / Original group id` leans more toward "provider raw trace layer"

## Rule Change Requirements

If correct `block_label -> type/sub_type/tags/derived` On change, update simultaneously:

1. Directory Documentation
2. Related fixtures
3. regression check
4. If necessary,translation extractor smoke
