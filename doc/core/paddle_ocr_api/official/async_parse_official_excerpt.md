# PaddleOCR-VL Excerpt from official service-oriented documentation

Source:

- GitHub Official documentation:
  <https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/pipeline_usage/PaddleOCR-VL.md>
- Please provide the source text to translate.
  `backend/rust_api/src/ocr_provider/paddle/AsyncParse.md`

This excerpt only retains content related to this repository. provider Đã hiểu. Chỉ dịch phần liên quan trực tiếp đến tích hợp, không sao chép toàn bộ hướng dẫn.  Vui lòng cung cấp nội dung cần dịch.

## 1. Present in official response. Markdown

Official service-oriented example shows the following usage:

- Iterate `result["layoutParsingResults"]`
- Read `res["markdown"]["text"]`
- Read res["markdown"]["images"]

That is to say, the Paddle official response includes not only structured prunedResult but also directly obtainable Markdown text and Markdown image mapping.

## 2. Critical response structure

The most directly relevant structure for integrating with this repository is:

```json
{
  "result": {
    "layoutParsingResults": [
      {
        "prunedResult": {},
        "markdown": {
          "text": "...",
          "images": {}
        },
        "outputImages": {},
        "inputImage": "..."
      }
    ]
  }
}
```

Field meanings:

- `prunedResult`: Structured page parsing results
- markdown.text: page-level Markdown text
- `markdown.images`: Markdown Relative path to image content/Address mapping
- `outputImages`: Visualization or intermediate image results
- `inputImage`: Input page image

Pay special attention here:

- `markdown.images` The key is not "suggested value", but Markdown/HTML Actual relative path referenced in the body
- If the body contains <img src="imgs/xxx.jpg">, then the key in images should be imgs/xxx.jpg
- The integrator must not alter this section without authorization. provider Returned relative paths are rewritten to a different directory specification; minimal reversible wrapping is permitted only at release time.

## 3. Request params tied to current main branch

- `restructurePages`
  For multiple pages. PDF Refactoring affects cross-page table and paragraph heading level recognition.
- `mergeTables`
  Merge tables across pages.
- `relevelTitles`
  Identify paragraph heading levels.
- `showFormulaNumber`
Controls whether formula numbers are included in Markdown.
- `prettifyMarkdown`
  Prettify output Markdown。
- `visualize`
  Controls whether to return image results.

## 4. System deployment conclusion.

The conclusion is straightforward:

1. `markdown_ready = false` Not attributable. Paddle Not officially supported. Markdown。
2. If the task raw Send source. `markdown.text` / `markdown.images`, it should be exported as a job markdown artifact in our artifact layer. job markdown artifact。
3. provider adapter / pipeline Clearly distinguish:
   - Structured Document Standardization
- Write Markdown artifacts to disk
   - Markdown Save image to disk
4. Markdown Image paths must follow provider Return value: page prefix added for multi-page task conflict prevention may only serve as outer-scope wrapping; internal relative path patterns must not be hardcoded.

## 5. Update principles

If continuing to supplement Paddle Documentation, prioritize filling here:

- Official Entry
- Fields parameters repository-related
- Corresponds to this repository. artifact / normalized document / provider adapter Mapping

Do not copy the entire official deployment tutorial verbatim.
