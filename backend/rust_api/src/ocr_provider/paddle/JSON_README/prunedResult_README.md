# prunedResult Structure and normalized_document_v1 Value mapping

This README For `rust_api/src/ocr_provider/paddle/json_full.json` in `layoutParsingResults[*].prunedResult` Written for output of adapter Quickly locate implementer key Field mapping logic for semantic understanding and normalization; identify fields suitable as trace/debug Keep.

## JSON Hierarchy

- `layoutParsingResults` is multiple layout results generated from same input by Paddle OCR (usually several `split`/`merge` versions).
- Each entry contains `prunedResult`(the normalization starting point we care about) and the source code's `markdown`/`outputImages`/`inputImage` Debug snippet pending
- `prunedResult` Directly include:
  - `page_count`Total pages
  - `width`、`height`(current layout Parse corresponding canvas size and units. px）
  - `model_settings`(Switches used in this reasoning turn, for reproduction.)/Troubleshooting）
  - `parsing_res_list`（Paddle Native block Structure list)
- `layout_det_res` (underlying layout detector box output, to facilitate trace to specific test results)

## Key field descriptions

### `page_count` / `width` / `height`
- directly provide document Page count and canvas size for level, recommend at normalized document Map to `document.page_count` and the default per page `page.width/page.height`, used for overflow/Zoom detection.

### `model_settings`
- Contains the switch fields for this parse. Field names and actual values:
  - `use_doc_preprocessor`: Preprocess documents?
  - `use_layout_detection`: Enabled? layout Detector
  - `use_chart_recognition`: Recognize charts?
  - `use_seal_recognition`: Enable seal recognition?
  - `use_ocr_for_image_block`: Is that correct? image block perform again OCR
  - `format_block_content`: Format text content? (e.g. trim）
  - `merge_layout_blocks`: Merge? layout Adjacent block
  - `markdown_ignore_labels`: Corresponding markdown ignored during generation block labelExample needed. Provide details. `number/footnote/header/...`
  - `return_layout_polygon_points`: whether in each block Attach polygon Information
- Recommend using this structure as adapter trace metadata (write to normalized document `meta.ocr_settings` or similar) for subsequent issue tracking or Rust layer `normalization_report` alignment.

### `parsing_res_list`
- Core block List, yes normalized_document First-hand input. Each field:
- `block_label`: Paddle predicted label (e.g. `header/paragraph_title/text/table/figure_title/footer`), can map to normalized block `type`/`sub_type` or `tags`.
- `block_content`: directly entered text. normalized block `text_content` or `lines` related fields.
- `block_bbox`: `[x0,y0,x1,y1]` corresponds to block axis-aligned bounding box.
- `block_polygon_points`: same as `block_bbox` but supports polygon (each point `[x,y]`), applicable to normalized block `polygon` field.
- `block_id`, `group_id`: local block/group ID, used to generate normalized block `provider_id` or `group_id`.
  - `global_block_id`、`global_group_id`: With global offset ID, across multiple layout Version/Keep unique across pages; recommend at normalized document as `meta.global_id` Track
  - `block_order`: Paddle Inferred reading order (some values in this example are `null`), can be used to fill `normalized_document.pages[].items[].order`
- Suggestions adapter Use the following approach:
1. Divide `parsing_res_list` by `block_order` or `block_id` page-wise (if `group_id` exists, use as `Page.blocks` `group` dimension).
2. Use `block_label` to categorize (`header`/`paragraph_title`/`text`, etc.), determine normalized block `type/sub_type` (e.g. `text` core content, `paragraph_title` as `title` type).
3. Assign `block_content` directly to normalized block `text`, retain `block_polygon_points` as `geometry.polygon`.
4. Sync `block_bbox` to normalized block `bounding_box` for frontend/render reuse.

### `layout_det_res`
- Includes layout detector raw boxes; current structure:
  - `boxes`: list of objects
  - Each box Own `cls_id`Classifier not needed. Use built-in function. ID）、`label`(category name)`score`confidence`coordinate`（`[x0,y0,x1,y1]`）、`order`Predict reading order. Optional. `null`）、`polygon_points`
- Suggest adapter treat `layout_det_res` as original detection trace:
- Can store in normalized document `meta.raw_traces.layout_det_res` with `boxes` logging label and score.
- `coordinate` / `polygon_points` correspond to `parsing_res_list` geometry; can verify consistency between the two (e.g. `merge_layout_blocks` causing differences).
  - `score` is a writable trace rather than a normalized block. Use `document.normalization_trace` for troubleshooting missed detections or false positives.

## Adaptation Suggestions

1. Adapter first reads `page_count`/`width`/`height` as normalized document basic page info; `layout_det_res.boxes` can synchronously provide `page_count` for upstream/downstream consistency check.
2. Generate one normalized block per item from `parsing_res_list`; `block_label` determines `type` (e.g. `table`, `image`, `text`); `block_content` becomes main text content; `block_order`/`group_id` used to build block reading order / segmentation.
3. All polygon/bbox/cursor related fields (`block_bbox` + `block_polygon_points` + `layout_det_res.boxes coordinate/polygon_points`) should all synchronously populate normalized block geometry and trace to avoid coordinate ambiguity across entry points.
4. Write `model_settings` and `layout_det_res` directly to debug trace (e.g. `normalized_document.meta.provider_trace.paddle.pruned_result`); include in `normalization_report`; only `parsing_res_list` `block_content`/`label`/`geometry` truly map to normalized document main flow.
5. For later `normalized_document_v1` schema, recommend saving original `block_id/global_block_id` and `group_id/global_group_id` in `blocks[].meta` to align with different provider IDs.

## Trace Reserved fields

- `model_settings`Save completely, facilitate alignment of experimental parameters with `normalization_summary`
- `layout_det_res.boxes`Invalid input. Fix: Provide valid command or request. `debug.traces.layout_detector`, keep `label/score/coordinate/order`
- `parsing_res_list` `block_polygon_points` and `block_id` are basis for locating blocks during later troubleshooting.
- Others such as `global_block_id/global_group_id` Directly writable. `blocks[].meta.source_ids`

Keeping the above conventions can adapter Generating normalized document Time not lost. Paddle The provided fine-grained semantics can also be used in trace Full restore complete. detection Process, facilitating subsequent rendering, debugging, and schema regression.
