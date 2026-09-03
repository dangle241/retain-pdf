# Rendering description

`scripts/services/rendering` Turn translated page data into final version. PDF。

Not responsible for translation, nor for anything else. OCR Parsing: only responsible for 'how to render, how to lay out, how to output'.

## Stage boundaries

Rendering The formal inputs and outputs of the stage are fixed as:

- Input:
Source PDF, translation product, render parameters
- Output:
Final PDF, and necessary overlay / typst / compressed intermediate artifacts

Clearly not responsible for:

- Do not consume directly provider raw OCR JSON
- Not responsible for. raw OCR Normalize to `document.v1.json`
- Understood.

Current stable handoff point:

- rendering mainline only accepts "source PDF + The set of inputs labeled "Translation artifacts".
- Fixed read at render stage. `translation-manifest.json`No. manifest Old translation directory no longer supports direct rendering.
- Render-only call protocol fixed to: source_pdf_path + translations_dir or source_pdf_path + translation_manifest_path
- Render-only Entry supported. `job_root/specs/render.spec.json`（`render.stage.v1`）
- If input does not conform to the protocol, throw uniformly at the entry point. `Render-only input error`, rather than later Typst/PDF Vague error reported only at stage.
- If in doubt about OCR structure issues, should first return to document.v1.json / document.v1.report.json for troubleshooting
- If you suspect issues with the translation content or terminology strategy, first return to translation payloadnot at rendering Layer supplement translation logic.
- Do not write credentials in render stage spec; use credential_ref in spec, injected with real values by the runtime environment key.

## Current directory structure

```text
scripts/services/rendering/
  __init__.py
  README.md
  legacy/          Legacy caller compatibility entry; do not place new logic here.
workflow/        Rendering stage orchestration. Dispatch only; no concrete execution of PDF/Typst details
  analysis/        Page profiling, page classification, and page routing decision.
document/        Source PDF page number mapping, bookmarks/table of contents and other document-level aids.
  source/          original PDF Preparation, cleanup, background reconstruction, and compression.
  layout/          Typesetting calculation from translation block to rendering block.
output/          Typst source code generation, compilation, overlay composition, and PDF writing
```

Recommended understanding order:

`workflow -> document/analysis -> source/layout -> output`

`legacy/` Compatibility facade for legacy callers. Do not add further business logic.

## Render main path

Current main path summary:

`translation JSON -> layout/payload -> output/typst -> PDF`

Upper layer typically via API calls. Use standard HTTP client. [render_stage.py](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline/render_stage.py) Invoke the capabilities here.

Input boundary:

- rendering The main line consumes the translated page payload Heyuan PDF
- Current page translation payload and translation-manifest.json are upstream default deliverables. Rendering layer reads only; does not define OCR/translation phase protocols.
- If upstream only wants to re-run rendering, pass explicitly. `translation_manifest_path`No fixed directory scan.
- OCR provider raw JSON should not flow directly here
- If upstream OCR structure is flawed, revert to document.v1.json / document.v1.report.json investigation at this layer, not patch rendering layer with provider special cases.

## Module division

- `legacy/`
  Legacy caller compatibility facade. Do not write new business logic here; only forward to specific modules.
- `workflow/`
  Orchestrates rendering flow: selects mode, chains steps. Typst/Background/redactionDo not directly write complex algorithms.
- `workflow/render_only.py`
render-only worker wrapper entry point.
- `analysis/profile/`
  Single-page fact collection layer. Answers only "what this page looks like"; does not decide rendering.
- `analysis/route/`
  Single-page route decision layer. Based only on. profile Determine route, do not operate directly. PDF。
- `layout/payload/`
  convert the translated OCR payload convert to renderable blocks.
- `layout/typography/`
  Layout measurement and geometry tool layer.
- `layout/inline_content/`
  Formula,Markdown、Typst inline Text Normalization.
- `source/render_source.py`
Source PDF pre-render: strip hidden text, select compressed copy.
- `source/cleanup/`
  Directly operate PDF Page object for text deletion, background overlay, and write-back.
- `source/background/`
  Local background rebuild for large-background image pages.
- `source/compression/`
  PDF Image compression.
- `output/typst/`
  Responsible for turning render blocks into Typst Source code and compile into PDF。
- `output/pdf_writer.py`
Backward compatible import re-export. New code should prefer document/pdf_ops.py.
- `document/pdf_ops.py`
Generic PDF save and page link handling helpers. Document-level foundational capability, not part of Typst output layer.
- `document/pikepdf_overlay.py` / `document/pikepdf_pages.py`
  Official PDF Structure write priority entry. For content streaming level. overlay Merge, Entire Book/Page-selection copy and path-level optimization.
- `layout/model/`
  Rendering layer public data structures and layout text helper。
- `layout/page_specs.py`
  Page-level render spec assembly; link translations. payloadPage geometry output layer.

## Background masking strategy

Typst overlay Path priority: use the text container's own background.

```typst
place(...,
  block(width: ..., height: ..., fill: ...)[
    translated content
  ]
)
```

Stop outputting a separate layer for ordinary translation blocks. `rect(...)` White block then output text. Text container with built-in background naturally binds white background and text, reducing layers, misalignment, and z-order issues.

Two things to distinguish:

- Visual masking: done by Typst block fill or white text box.
- Text layer cleanup: still handled by source/cleanup and redaction policy; cannot be replaced by visual masking alone.

## PDF Write principles

Production PDF Prioritize structural modifications. `pikepdf`：

- content stream text-op Delete
- hidden text strip
- Entire book Typst overlay merge
- Page-by-page cleanup for source-less pages, Typst fallback overlay merge
- No source page modification required, single-PDF overlay merge
- Path-level bbox rect text-op deletion
- PDF Copy, extract selected pages, and restructure.
- Image Object Compression / Replace

PyMuPDF Maintain read analyze scenarios

- Page size, text,bbox、drawing Analysis
- Screenshots and debug preview
- Color sampling, first-line indent detection, and other visual aids.

Do not add new features to the new main chain. PyMuPDF destructive write：

- No new code. `apply_redactions`
- Do not add show_pdf_page as official overlay merge
- Do not add insert_pdf + doc.save copy path as structure

Existing PyMuPDF write-only legacy/fallback retained. Prioritize during migration: document/pikepdf_* or
`source_cleanup` Chinese path-level tool replacement.
in-page `remove_text_under_rects_with_pymupdf_redaction` Belongs legacy redaction Boundary; add text layer cleanup priority use. Delete redundant text layers first. Add when necessary. `source_cleanup` Package Path Level pikepdf rect-strip capabilities.pikepdf text strip only delete translatable text blocks,`formula` / `display_formula` bbox Keep original as protected area PDF Formula; other body text on formula page./Figure captions deletable. Pages with formulas no longer skipped entirely.
Pre-rendering processing will workflow Transfer `source_text_precleaned_page_indices`, which includes pages where text-ops were actually deleted and pages with no detected overlapping source text; the overlay stage uses this to determine whether it can skip the old in-page visual cover/redaction. text-op pages, and pages detected without original text overlap;overlay stage uses it to determine whether to skip old in-page visual cover/redaction。
`source_cleanup_strategy=pikepdf_text_strip` Official policy name. Use for future configurations.
Rendering diagnostics will record legacy_pymupdf_redaction_pages, legacy_pymupdf_overlay_pages, and legacy_pdf_write_reasons. When regressing on real samples, first observe whether these values remain non-zero.

## Pure Typst Compilation speed

Large Document overlay Path must not degenerate into page-by-page. Typst Compile. Page by page. PDF Re-embedding fonts and resources bloats final file size.

Current shard is explicit. opt-in Strategy not default. Default whole-book priority. Typst Compile, because this typically yields the smallest size, and compiling entire large documents is not slow.

Explicit enable: controlled-size large chunks:

- Settings: Only RETAIN_TYPST_OVERLAY_CHUNKED=1 can use pikepdf to merge overlays; only enabled for large documents.
- Default: 256 pages above which sharding is enabled; default per shard: 128 pages.
- Generate one multi-page overlay PDF per shard, then merge into the original PDF once using pikepdf.
- Small documents continue using full-book compilation Typst Compile, keep size optimal.

Configurable environment variables:

- `RETAIN_TYPST_OVERLAY_CHUNKED=1` Enable sharded compilation.
- `RETAIN_TYPST_OVERLAY_CHUNK_MIN_PAGES` Adjust enable threshold.
- `RETAIN_TYPST_OVERLAY_CHUNK_PAGES` Adjust pages per chunk. Do not set too small unless file size confirmed acceptable.

## Render Prewarm Reuse

`render_prewarm` Supports two types of artifacts:

- source Output: preprocessed source PDF、bbox text-strip candidates。
- payload Artifacts: first-line indent,effective inner bboxColor profileDark mode page specs。

render-only Phase must reuse both artifact types simultaneously. Note: sync refresh. source manifest Cannot clear existing
`payload_prewarm`otherwise overlay Rendering reruns. payload prepare and color sampling.

Real 635-page sample, payload prewarm hit:

- `color_adapt_elapsed_seconds` Abide by Agreement `14.1s` Reduce to approx. `0.1s`。
- payload_prepare_elapsed_seconds from about 22.3s down to about 9.9s.
- total render-only from about 49s down to about 23s.

## Real PDF regression

Place real samples [resources/samples/golden-pdfs](/home/wxyhgk/tmp/Code/resources/samples/golden-pdfs)。

Common commands:

```bash
python3 backend/scripts/devtools/run_golden_flow.py --check-manifest
python3 backend/scripts/devtools/run_golden_flow.py --list-samples
python3 backend/scripts/devtools/run_golden_flow.py \
  --job-root data/jobs/golden-fullflow-book-20260511170519 \
  --render-only \
  --bbox-item p001-b013
python3 backend/scripts/devtools/run_golden_flow.py \
  --job-root data/jobs/golden-pseudo-20260512-full \
  --render-only \
  --bbox-item p001-b013
```

Current minimal regression set:

- `editable-paper-formula`Editable Paper PDFcovering text layer, formulas, and general. Typst Background rendering.
- `pseudo-editable`Pseudo-editable PDFCoverage Scan/Background image risk. Text layer retention risk.

Regression script checks:

- Sample list valid.
- Final PDF page numbers consistent with source PDF.
- No translation diagnosis. unresolved Item.
- Typst placement coordinates of sampled blocks consistent with OCR bbox top-left.

## Import Boundary

- runtime/pipeline Call only `workflow/` Stable entry point.
- `analysis/route/` can depend on `analysis/profile/`, but `analysis/profile/` Do not reverse-depend. `analysis/route/`。
- `layout/` Do not call directly source cleanup； it only generates layout/Render block.
- `output/typst/` Should not redo OCR/Translation judgment; when page facts are needed, from profile/route Incoming.
- `source/cleanup/` Operable PDF Page object, do not generate. Typst Source code.
- New code should prefer importing specific module, do not depend on package root __init__.py re-exports.

## Recommended entry points

- [render_stage.py](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline/render_stage.py)
- [services/rendering/workflow](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/workflow)

## Formula regression

If adding a new formula normalization rule, directly append bad examples to
[`devtools/tests/translation/test_formula_math_markers.py`](/home/wxyhgk/tmp/Code/backend/scripts/devtools/tests/translation/test_formula_math_markers.py)
Parameterized regression testing within.

## Collaboration rules

If rendering module maintained separately, this layer only reads translation artifacts and generates final. PDF”。

- Allowed here: modify overlay, Typst background processing, compression, red-box erasure, layout refill
- Do not add OCR provider Special case; do not append translation requests or term replacement logic here either.
- Formal input boundary is `source_pdf_path + translations_dir/translation_manifest_path`
- If modifying the rendering input protocol,manifest Reading method or final artifact naming: sync update required. `runtime/pipeline`Entry pointREADME and Test
- Encountered upstream OCR Or translation issue, prefer returning the problem to the corresponding module for fix, do not rendering Layer Stack Cross-Layer Patch
