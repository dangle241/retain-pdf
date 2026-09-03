# Layout Fit Lab

Current absolute path unknown. Provide the path or context.

`/home/wxyhgk/tmp/Code/experiments/layout-fit`

Existing task data directory:

`/home/wxyhgk/tmp/Code/data`

Current task directory:

`/home/wxyhgk/tmp/Code/data/jobs`

This directory is a layout experiment zone. Goal: explore two capabilities:

1. Use `HTML/CSS` for text block layout fitting
2. Use experimental results to assist in reverse. `Typst` Choose appropriate font size, line height, tracking, and paragraph settings.

This is not production code. Short-term: methodology and experimental results, not direct mainline integration.

## Current minimum working mode

Currently, do not from upload,OCRRerun full pipeline.  
Current phase: base on existing only. `data/jobs/{job_id}` Perform re-rendering and layout fitting experiments on the internal artifacts.

Thus, experimenters prioritize data from here:

`/home/wxyhgk/tmp/Code/data/jobs/{job_id}`

A typical task directory usually contains:  README.md src/ tests/ Makefile .gitignore ponytail: skip if single-file script; add when project grows

- `source/`
Original PDF.
- `ocr/`
OCR and MinerU related artifacts.
- `translated/`
  Intermediate artifacts after translation.
- `rendered/`
Rendered results and Typst related artifacts.
- `artifacts/`
  Externally registered download artifacts.
- `logs/`
  Operation Log

Current experiment principles:

- Prioritize reusing existing results from `data/jobs`
- Do not re-invoke MinerU
- Do not re-invoke LLM translation
- Don't modify original. job Files in the directory
- If experimental results need to be generated, write to `experiments/layout-fit/output/`
- If you need to copy the small sample, copy to `experiments/layout-fit/fixtures/`

The purpose is clear: first put the “same copy... OCR/Verify whether different layout algorithms improve rendering of translated results.

## Key JSONs JSON Where to view

Layout, font, line height, block fitting experiments: start with these files:

- Main OCR unified structure:
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/ocr/normalized/document.v1.json`
- OCR Unified Structure Documentation:
  `/home/wxyhgk/tmp/Code/backend/scripts/services/document_schema/README.md`
- OCR Unified Structure Machine schema：
  `/home/wxyhgk/tmp/Code/backend/scripts/services/document_schema/document.v1.schema.json`
- Original OCR provider summary:
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/ocr/mineru_result.json`
- Original OCR unpacked content:
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/ocr/unpacked/layout.json`
- Original OCR content list:
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/ocr/unpacked/content_list_v2.json`
- Translate page-level results:
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/translated/page-XXX-deepseek.json`
- Domain context:
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/translated/domain-context.json`
- Typst Layout Input and Output:
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/rendered/typst/book-overlays/book-overlay.typ`
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/rendered/typst/book-overlays/book-overlay.pdf`
- Event stream:
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/logs/events.jsonl`
- Task summary:
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/artifacts/pipeline_summary.json`

## Prioritize which during experiment? JSON True source

Layout experiments: clear priorities:

1. `document.v1.json`
   Current main link after standardization. OCR Zhenyuan, best for block-level typesetting fitting.
2. `translated/page-XXX-deepseek.json`
   View per-page translated block content; preserve placeholders and translation results.
3. `book-overlay.typ`
   View current Typst How are parameters passed and formatted in practice?
4. `layout.json` / `content_list_v2.json`
   Only when needing to revert to original. OCR provider Review on output; do not treat as primary experiment input.

Simply put:

- To study 'how blocks are arranged', first see `document.v1.json`
- Investigate post-translation text. Review. `translated/*.json`
- slow, or Typst "How exactly is it sorted out?", then look again. `book-overlay.typ`

## Where to start

Newcomers: follow order below.

1. This file:
   `/home/wxyhgk/tmp/Code/experiments/layout-fit/README.md`
2. OCR Unified structure description:
   `/home/wxyhgk/tmp/Code/backend/scripts/services/document_schema/README.md`
3. Select a real task directory:
   `/home/wxyhgk/tmp/Code/data/jobs/{job_id}`
4. First open:
   - `ocr/normalized/document.v1.json`
   - `translated/page-001-deepseek.json`
   - `rendered/typst/book-overlays/book-overlay.typ`

This basically tells you:

- OCR What does it look like after standardization?
- What does the translated result look like?
- Typst Input consumed and layout produced.

## Why create this directory separately

The current main project already has a stable frontend,Rust API、Python Pipeline and Typst Rendering pipeline.  
But questions like "how to choose font size, how to determine line spacing, how to fit a text block as closely as possible within a target box" are essentially still experimental issues, not suitable to be directly crammed into production code.

Thus, set up a separate testbed here:

- Do not pollute `backend/` and `frontend/`
- Fast trial-and-error.
- Multiple approaches can be kept in parallel.
- After experiment matures, migrate stable parts back to production pipeline.

## Directory Conventions

- `fixtures/`
  Provide experimental input data. Prefer small, refined samples; do not directly input the entire book.
- `html/`
Place HTML/CSS/JS layout experiment pages.
- `typst/`
Place Typst samples for comparison, HTML fitting results, and current Typst strategy.
- `scripts/`
  Place automation scripts: parameter scanning, error scoring, result aggregation.
- `notes/`
  Include stage conclusions, parameter records, failure cases, and follow-up ideas.
- `output/`
  Place local artifacts, e.g., screenshots, scoring results, debugging. JSONDirectory not entered by default. Git。

## Recommend researching boundaries

Start with page fragment recovery.

Three-layer recommendation.

1. `text metrics`
   Study only font size, line height, letter spacing, and paragraph width for a single text block.
2. `block layout`
   Fit text block tightly within given target box.
3. `page composition`
   Place fitted blocks back on page. Check collisions, overflow, order errors.

In the short term, layers 1 and 2 are most important.

## Specific questions worth exploring

### 1. Font size fitting

Input:

- Text content
- Target box width and height
- Font Family
- Default font size range

Output:

- Optimal Font Size
- Line count, total height, overflow at this font size.

### 2. Fit line height

Input:

- Fixed Font Size
- Different line-height candidate values

Output:

- Which line height is closest to the target box height?
- whether it causes orphans, overflow, or over‑compression

### 3. Letter-spacing and paragraph compression

Input:

- Fixed font size and line height
- Custom character spacing, word spacing, and paragraph spacing settings

Output:

- whether the text can be made closer to the target box without significantly harming the reading experience

### 4. Typst Reverse parameter inference

The goal is not to use. HTML Replace Typstbut rather use HTML Answer with experimental results:

- What font size fits this block better?
- Should line height be looser or tighter?
- Under certain layout densities,Typst Are the current default parameters too conservative?

## Explicit exclusions.

Avoid the following for now to prevent scope creep:

- Do not start with a full HTML rearrange of the entire book PDF
- Do not prioritize complex image-text layout recovery.
- Do not prioritize final solutions for tables, formulas, or floating captions.
- Don't modify production rendering pipeline directly.
- Don't experiment with translation strategies unrelated to layout here.

## Recommended input samples

Extract 5 to 10 sample blocks from existing tasks.

- Single paragraph body
- Two to three continuous paragraphs.
- Heading
- Paragraph with inline formula
- Mixed Chinese-English paragraph
- Dense small-font paragraph.
- Widely-spaced large paragraphs.

Minimum recommended per sample:

- Original text
- Translated text
- Bounding box coordinates and dimensions.
- Page width and height
- Current Typst parameters
- Render result screenshot or reference image.

## Recommended tech stack

### Route A：HTML As a meter

Approach:

- Compute text's actual layout at target width using browser layout engine.
- Scan font size, line height, tracking.
- Select the parameter set with the minimum error.

Advantages:

- Rapid iteration
- Convenient visualization
- Block-level experiments first.

Disadvantages:

- Not entirely consistent with Typst layout models.
- Only as fitting reference, not final ground truth.

### Route B: HTML-assisted Typst

Approach:

- First use HTML to search for a better parameter range.
- Then feed the parameters to Typst Re-verify sample

Pros:

- Closer to actual production pipeline
- Experimental results can be migrated back to the main system.

Cons:

- Higher implementation complexity.
- Debug speed is slower compared to pure HTML

Current suggestion: prioritize `Route A`, then fill in `Route B` later.

## Suggest minimal closed loop first.

1. Insert 5 to 10 text block samples in `fixtures/`
2. Write a minimal experiment page in `html/` supporting:
   - Input text
   - Enter target width and height
   - Switch Font
- Scanning font size, line height, and letter spacing
3. Write a scorer in `scripts/` that outputs:
   - Height error
   - Width out of bounds
   - Lines
   - Overflow?
4. Record optimal parameter distribution per sample class in `notes/`.
5. Match against the sample in `typst/` to see if these parameters can be migrated back to Typst.

## Suggested rating method

Do not pursue overly complex loss functions. Start with a simple interpretable version.

- Minimize height error.
- Width overflow: immediate penalty.
- Line count deviation may be moderately penalized.
- Penalty for font size too small.
- Excessive row height will be penalized.

You can start with an approach similar to the following:

`score = height_error * a + overflow_penalty * b + line_count_penalty * c + readability_penalty * d`

Focus: scoring stability, interpretability, iterability — not formula elegance.

## Delivery Requirements

The person taking over this directory must deliver at least the following:

1. Minimal local HTML file opens in browser. HTML Experimental Page
2. A representative small-scale sample
3. ```python import sys import json from pathlib import Path  def scan_params(config_path: str) -> dict:     cfg = json.loads(Path(config_path).read_text())     return {k: v for k, v in cfg.items() if isinstance(v, (int, float))}  if __name__ == "__main__":     print(json.dumps(scan_params(sys.argv[1]))) ``` → skipped: type validation, add when input from untrusted source.
4. A phase summary, explaining:
   - Which blocks are prone to overfitting?
   - Which blocks are difficult to fit?
   - Which parameters are most sensitive?
   - HTML Results and Typst How much difference?
5. Suggestions for main project:
   - whether it is worth integrating
   - Which layer to connect to?
   - What are the risks

## Handover requirements

If you're taking over this experiment, do these first:

1. Read this file first
2. First, in `notes/` Write a one-page experimental plan
3. Don't modify main project directly.
4. Verify one assumption at a time; do not mix multiple variables.
5. Conclusions must be accompanied by samples, screenshots, or scoring results; do not write only subjective judgments

## Current Suggestion

The most reasonable entry point currently is not "whole page HTML "typesetting", but rather "block-level fitter".

Once block-level fitter stabilizes, three uses follow:

- Direct service HTML rendering
- Provide better initial parameters for Typst.
- For future use. Word/DOCX Export provides font size and paragraph style reference.

Unstable step. Full-page recovery amplifies issues.
