# layoutParsingResults[*].outputImages Usage

`json_full.json` `layoutParsingResults` is per-page OCR output outermost structure. After obtaining this array, adapter/debug script processes each page's `prunedResult` structuring, `markdown` strategy judgment; attach visual aid `outputImages`. In current Paddle provider examples, each page's `outputImages` has one item:

| Key name | Sample Content | Description |
| --- | --- | --- |
| `layout_det_res` | `https://.../layout_det_res_0.jpg?...` | layout detection overlay plot, renders all `prunedResult.parsing_res_list` blocks' polygon/bbox onto original image. URL is Paddle OCR production CDN with temporary authorization. |

If others are added later key(For example, some kind `crop_*.jpg` / `summary_vis` Etc.) also stored in this dict; naming should continue following `<stage>_<purpose>` Distinguish by semantic level.`outputImages` Optional field; presence implies provider Currently stage Generated meaningful visualization to aid understanding of segmentation results.

## Adoption strategies for various consumer segments

### Adapter（schema adapter)
- Suggest in `document_schema` regression or fixture checking, use `layout_det_res` as auxiliary reference for structure validation. Use this diagram to quickly confirm whether `prunedResult`'s `block_bbox`/`polygon_points` match actual detected layout, especially when normalized document has missing/extra blocks; refer back to diagram for faster issue localization.
- Do not recommend arbitrary image URL directly write normalized documentClass diagram debug-only. Remove before release. downstream schema field, but can regression report Attach a link beside it for new. provider Check whether you missed any critical formatting.

### Debugging Tools (Scripts, Runtime Logs)
- `layout_det_res` is the most direct visual debugging entry: when reproducing a case, download that URL locally to view layout detection overlay. Suggest features: `regression_check.py`, `validate_document_schema.py` scripts output summary with this URL (or write into `reporting.py` generated summary), so operator on normalized document failure automatically opens corresponding page's visual result.
- Other potential `outputImages`(such as future Layout crop diagram) should also only debug Only log in mode./File system: avoid retaining large numbers of temporary images in the production data pipeline.

### 前端预览/Diagnostics
- `layout_det_res` Ideal for “layout QA” visualization panel (e.g., show original image, detection results in debug console) overlay、normalized tree Chained. URL Authorized and large. Treat as clickable optional. Do not auto-fetch in main flow. Prevents frequent frontend triggers in production. CDN Verify.
- If future need for cropped images or read-only graph visualization, add new `crop_*`, `vis_fit_res` fields in `outputImages` for frontend/reporting use; still enforce README constraint: only QA/diagnostic page read-only.

## Field retention suggestion

- `layout_det_res`: retain. Even if not primary flow data, keep a copy of URL or landing files (e.g. `artifacts.py` `layout_det_res_*` directory) in provider attachment/regression report for subsequent visual alignment checks.
- Other `outputImages` fields if name clearly corresponds to debug/crop scenario (e.g. `block_crop_res`, `layout_vis`), can persist as needed; but in principle, as long as not used to build normalized document, they are debug/visualization scope, enable on demand and not parsed into schema.

## Related field hint

- `inputImage` in each `layoutParsingResults` provides original input image (`input_img_N.jpg`), frontend loading overlay should first load this image, then `layout_det_res` as overlay layer.
- `preprocessedImages`Overall JSON Outermost layer provides. preprocessed Figure (e.g. `preprocessed_img_0.jpg`) is the pre-check draft, suitable as reference for diagnosing model preprocessing effects, not part of `outputImages`, therefore in README Only add supplementary notes.

Write these conventions in README; adapter/debug script directly references this file, eliminating repeated chart-availability checks across scripts. Aligns with current focus: documentation/scripts/all regressions unified around schema core. Visuals assist only.
