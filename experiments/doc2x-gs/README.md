# doc2x-gs PDF Content stream body removal experiment

This directory reproduces "delete main text but keep display formulas". PDF content stream Experiment.

## Goal

Verify a ratio. bbox More granular coverage plan:

- Unpaginated grid layout.
- Not press big bbox One-size-fits-all deletion.
- directly rewrite PDF content stream；
- Delete Normal Body Text `TJ/Tj` text-show Action;
- Preserve fine details in display equations. `Tj/Tm` Operations and vector elements
- Add ours on top later. Typst Chinese translation.

Closed-source reference file `Electronic structure methods-Chapter 4-Gao Siji Group-onlyTrans.pdf` Basically similar approach: original English body not extractable, but display formulas remain as PDF Source text missing. Provide content to translate./Vector.

## Files

- `Electronic-Structure-Methods-Chapter-4-Gaussian-Basis-Sets.pdf` Original Sample: PDF.
- `Electronic-Structure-Methods-Chapter-4-Gaussian-Basis-Sets-onlyTrans.pdf` Closed-source project output for comparison.
- `content_stream_text_strip.py`: Current POC Script.
- `work/`Experiment output directory.

## Execution

Run in this directory:

```bash
python3 content_stream_text_strip.py \
  --input Electronic structure methods-Chapter 4-Gaussian basis.pdf \
  --output work/content-op-strip.pdf \
  --diagnostics work/content-op-strip-diagnostics.json \
  --preview work/content-op-strip-page1.png \
  --pages 1
```

Also run the expert's suggested "first redact "Paste back to formula area" option:

```bash
python3 redact_restore_formula.py \
--input Electronic-Structure-Methods-Chapter-4-Gaussian-Basis-Sets.pdf \
  --output work/redact-restore-formula.pdf \
  --diagnostics work/redact-restore-formula-diagnostics.json \
  --preview work/redact-restore-formula-page1.png \
  --pages 1
```

Output:

- `work/content-op-strip.pdf`
- `work/content-op-strip-diagnostics.json`
- `work/content-op-strip-page1.png`

## Current Results

For page 1 Page:

- English body, English title, footer deleted;
- Three inline formulas preserved.
- PDF No image conversion; formulas remain raw. PDF Object
- Extraction leaves essentially only formula blocks.

## Current limit

This is still a sample. POC, not a general backend implementation.

The current rule uses this. PDF Structural features:

- Main body encoding: long. `TJ` Array;
- Inline formulas primarily encoded as numerous fine fragments. `Tj/Tm`；
- Orphaned variables in body need extra rules to clear.

Backend generic version still needs:

- Stable `Tj/TJ -> bbox` Mapping;
- Integrate PaddleOCR `display_formula` bbox as a protected area;
- Within protected zones, preserve original text; outside, delete body text.
- And existing Typst overlay / source cleanup Make strategy an optional rendering mode.

## Recommended integration direction

Experts: prioritize integration. `apply_redactions + show_pdf_page`, because the engineering complexity is much lower than a full text-op interpreter。

Backend flow could be:

1. Retain `display_formula` bbox during OCR stage.
2. Perform redaction on body translation bbox during cleanup stage.
3. Revert redaction to Original PDF by clipping and restoring formula area via `display_formula` bbox.
4. Overlay Typst Chinese translation again.
5. If reply fails, fall back to existing. bbox cover/strip。
