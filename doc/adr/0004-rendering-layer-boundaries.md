# 0004 Render layer layered by workflow/analysis/source/layout/output

## Background

Rendering layer simultaneously processes page profile and raw PDF Cleanup, Background Rebuild, Translation TypesettingTypst Generate and PDF Write out. Old structure grew organically with technical files, causing... `source`、`layout`、`output` Bridge logic stacking occurs. Remove font overrides. Delete strategy. overlay May affect each other easily.

Typical issues:

- `source/background` Built-in layout block, and also redactionmerge again overlay。
- Generic PDF save capability placed in output/pdf_writer.py caused source to reverse-depend on output layer.
- `layout/typography/measurement.py` Includes both bbox Measurement, line count prediction, compactness, body text candidates, and page baseline font size.
- RenderLayoutBlock and RenderBlock dual tracks exist; field calculations duplicate.

## Decision

Rendering layer top-level directories layered by stable responsibilities:

- `workflow`Process orchestration.
- `analysis`Page/Document facts and route judgment.
- `document`Document-level general capabilities, e.g., metadata、page map、PDF Save Assistant
- `source`: original PDF Preparation, cleaning, background reconstruction, and compression.
- `layout`Translation layout, fonts, line spacing.bbox fitRendering block model.
- `output`：Typst/PDF overlay output.
- `legacy`Old entry compatibility only. No new business logic.

This refactoring implements several boundaries:

- source/background/redaction_plan.py only consumes RenderBlock, no longer calls layout.payload.blocks.
- `build_render_blocks` Move up `output/typst/source_page_overlay.py` This bridging layer.
- save_optimized_pdf and strip_page_links sunk to document/pdf_ops.py.
- layout/model/block_view.py serves as unified view for RenderLayoutBlock -> RenderBlock.
- output/typst/block_fields.py unifies Typst emitter bbox/font/color field calculations.
- Typst overlay Path uses text container's own background; no independent background for normal translation blocks. `rect(...)` White block.
- `layout/typography/measurement.py` Keep compatibility exports; refactor real logic to single-responsibility modules.

## Consequences

- New code must not cross layers arbitrarily. importMust pass. `backend/scripts/devtools/check_pipeline_architecture.py`。
- `legacy/` Only re-export Or for legacy caller compatibility; do not host new logic.
- source can manipulate PDF page objects, but should not be aware of Typst output details or construct layout payload itself.
- `layout` Output typography model only; do not clean directly. PDF Or generate Typst。
- output Layers can bridge, but need to avoid OCR/Include translation judgment.
- Separate visual masking and text layer cleaning.Typst/Word The text container background handles only the visual layer.PDF Original text layer remains `source/cleanup` / redaction Strategy responsible.

## Verification

Current basic verification:

```bash
python3 -m pytest backend/scripts/devtools/tests/rendering -q
python3 -m pytest backend/scripts/devtools/tests/text_layout -q
python3 -m compileall -q backend/scripts
python3 backend/scripts/devtools/check_pipeline_architecture.py
```

Real PDF render-only regression:

```bash
python3 backend/scripts/devtools/run_golden_flow.py \
  --job-root data/jobs/golden-fullflow-book-20260511170519 \
  --render-only \
  --bbox-item p001-b013

python3 backend/scripts/devtools/run_golden_flow.py \
  --job-root data/jobs/golden-pseudo-20260512-full \
  --render-only \
  --bbox-item p001-b013
```

These two samples respectively cover editable papers. PDF and pseudo-editable PDF。

## Alternatives

- Continue natural file-based splitting; no boundary checks. Fast short-term, but cross-layer patches will accumulate.
- Directly import tach or import-linter. More systematic, but currently check_pipeline_architecture.py already holds the critical boundary, which is enough.
- One-time merge of RenderLayoutBlock and RenderBlock is theoretically cleaner, but impact on Typst output, redaction, and page spec is too risky; use block_view for progressive unification.
