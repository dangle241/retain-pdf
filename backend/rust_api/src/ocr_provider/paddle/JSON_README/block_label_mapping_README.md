# Paddle block_label Create mapping table. Simplify: Use dictionary, add when complexity grows.

This document is based on [json_full.json](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/json_full.json)'s `layoutParsingResults[*].prunedResult.parsing_res_list[*].block_label` actual enumeration results collated for follow-up. `Paddle -> document.v1` adapter provide first stable mapping.

## 1. Observed in current sample block_label

Enumerated from current 3-page sample. label Below:

| block_label | Count | Description |
| --- | ---: | --- |
| `text` | 25 | Body text |
| `paragraph_title` | 12 | Paragraph Title/Subsection Title |
| `header` | 6 | Header |
| `footer` | 6 | Footer |
| `figure_title` | 4 | Image title or table title |
| `table` | 2 | table body, the content is HTML table |
| `image` | 1 | Image subject; content typically `<img>` HTML |
| `algorithm` | 1 | Code/Algorithm Block |
| `display_formula` | 1 | Display formula |
| `vision_footnote` | 1 | Visual footnote/Table Notes/Note |

## 2. Actual sample excerpt

### `text`
- page 1 / block 4
  Mixed Chinese-English body text.
- page 1 / block 6
  Ordinary body text with inline formulas and explanatory text.

Suggestion:
- directly use as normalized Main body block entry.

### `paragraph_title`
- page 1 / block 3
  `## 1. JSON Split Profile`
- page 1 / block 5
`### 1.1. ç»ææ¦è§`

Suggestion:
- Heading block: do not merge with ordinary. `text`。

### `header`
- `PaddleOCR JSON Split Research`
- `March 31, 2026 · Provider: Paddle`

Suggestion:
- Default to keeping as structural blocks, but the main translation pipeline should usually skip.

### `footer`
- `Confidential Draft`
- `Page page.number / pages.count`

Suggestion:
- Default retain as structural blocks; main translation pipeline usually also skipped.

### `figure_title`
- Figure caption
- Table caption

Note:
- this label in Paddle Sample covers both "Figure Title" and "Table Title." Not equivalent. `image_caption`。

### `table`
- Content complete. HTML table string

Suggestion:
- Keep original first HTML Content
- Decide later whether to further split cells into structured. table schema

### `image`
- Content is usually `<img src=...>` snippet

Suggestion:
- Treat as the main block of the image area; do not take. `block_content` When body text

### `algorithm`
- Current sample is a code block./Command block

Suggestion:
- First map uniformly to. `code`
- If later Paddle Contains real algorithm pseudocode. Decide later on subdivision. `algorithm_block`

### `display_formula`
- Content is `$$ ... $$`

Suggestion:
- Directly maps to `formula`
- Preserve original LaTeX/Math string

### `vision_footnote`
- Current sample is `è¡¨æ³¨ï¼æ°å¼åªæ¯ç¤ºæï¼ä¸ä»£è¡¨çå® benchmark ç»è®ºã`

Suggestion:
- First treat uniformly as footnote/caption_note class
- Such fields often appear near charts; preserve adjacency clues.

## 3. First version. normalized_document_v1 Mapping suggestions

First provide conservative, stable mapping. Do not aim for one-shot perfection.

| Paddle block_label | normalized type | normalized sub_type | Notes |
| --- | --- | --- | --- |
| `text` | `text` | `body` | Body |
| `paragraph_title` | `text` | `heading` | Refer later by number./Subdivide levels |
| `header` | `text` | `header` | usually skip translation |
| `footer` | `text` | `footer` | usually skip translation |
| `figure_title` | `text` | `caption` | Glossary first. Terms to standardize? captionGraph traversal uses adjacency list. Simplify: adjacency matrix if dense graph, add when sparse graph./Table header |
| `table` | `table` | `table_html` | retain original HTML text |
| `image` | `image` | `image_body` | Text logic not used. |
| `algorithm` | `code` | `code_block` | Unify to code blocks first |
| `display_formula` | `formula` | `display_formula` | display formula |
| `vision_footnote` | `text` | `footnote` | Caption/Table note/Footnotes centralized here. |

## 4. Which fields need extra retention? raw trace

Suggest each normalized block all retain the following provider trace：

- `provider = "paddle"`
- `source_page_index`
- `source_block_index`
- `source_block_label`
- `source_block_id`if any
- `source_group_id` (if present)
- `source_bbox`
- `source_polygon`

Reason:
- `figure_title` Graph title vs table title. Adjacency matters. Check structure.
- `vision_footnote` May need further splitting later. `table_footnote` / `image_footnote`
- `table` Currently is HTML String. Later structured table splitting: trace to original block.

## 5. 1. Define success metric. 2. Identify bottleneck. 3. Delete non-essentials.

1. First write `block_label -> normalized type/sub_type` pure mapping function of
2. For `figure_title` and `vision_footnote`, conservatively fallback to `caption/footnote`
3. Don't immediately deeply decompose `table` and `image`; first stably keep them as blocks.

## 6. Engineering conclusions from current samples

- Paddle's `figure_title` label is mixed. Infer 'chart title' or 'table title' from block context.
- `table` and `image` `block_content` is more like rich text or embedded fragments; ordinary body extraction logic not applicable.
- `algorithm` Currently is more like a code block, do not open a separate complex branch.
- `display_formula` Separate tags; this is better than MinerU more direct, and should be prioritized.

## 7. Suggested follow-up files

If next step starts writing. adaptersuggest adding directly:

- `paddle/block_labels.py`
  only responsible for label Mapping and Label Determination
- `paddle/adapter.py`
  Go ahead `json_full -> document.v1`
- `paddle/trace.py`
only handle provider raw trace landing point

so that later when encountering new labelOnly change. `block_labels.py`, won't pollute the main adapter. adapter。
