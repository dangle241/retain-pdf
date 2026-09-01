#set page(
  margin: 18mm,
  header: context {
    box(width: 100%)[
      #set text(font: "Noto Sans", size: 9pt)
      PaddleOCR JSON Split Research #h(1fr) March 31, 2026 · Provider: Paddle
    ]
  },
  footer: context {
    box(width: 100%)[
      #set text(font: "Noto Sans", size: 9pt)
      Confidential Draft #h(1fr) Page page.number / pages.count
    ]
  },
)

#set text(font: "Noto Serif CJK SC", size: 10.5pt)
#set heading(numbering: "1.")

= JSON Split Profile

PaddleOCR JSON split research file. Goal: make layout, segments, metadata, table, formula, image layers easier to decouple during subsequent adaptation. This document deliberately mixes English and Chinese to cover bilingual metadata; inline formula $lambda = 1.5$ simulates confidence bias used in split heuristics.

== Structure overview

This paragraph mixes short English phrases and short Chinese sentences to imitate how OCR records title, body text, and side metadata on one page. Following paragraph contains inline formula $E = m c^2$ and short prompt text, suitable for observing PaddleOCR's splitting behavior for text spans and inline math.

Research steps:

+ Define the core JSON slice labels: `layout`, `text_segments`, and `metadata`.
+ Map each slice to either the normalized document or the report cache.
+ Document how downstream services consume these slices without re-parsing raw OCR.

Notes: Validation set uses line-based text field, so benchmark and offline debugging can reuse the same JSON batch.

== Keywords & Process

Following items cover short bullet lists, code-style words, and mixed Chinese-English:

- `text_segments`: used for translation and rendering prompts.
- `layout_hierarchy`: retained only in normalized document structure layer.
- `report_summary`: only generated through shared helper; must not be re-derived in business code.

The visual cue in Figure 1 shows how the split occurs between layout and metadata. The inline formula $s_i = e^(x_i) / sum_(j) e^(x_j)$ highlights the confidence distribution used for selecting segments.

#figure(
  image("diagram.svg", width: 120mm),
  caption: [Figure 1. PaddleOCR JSON split flow between layout, text, and metadata.]
)

== Tables and footnotes

Use this table to keep downstream document consumers consistent with field semantics.

#figure(
  table(
    columns: (24%, 38%, 38%),
    align: left + horizon,
    stroke: 0.4pt,
    inset: 5pt,
    [*Field*], [*Description*], [*Example*],
    [`layout.json`], [Raw bounding boxes and tokens], [`[[x, y, w, h, text]]`],
    [`document.v1.json`], [Normalized hierarchical document], [`{"pages": [...]}`],
    [`report.json`], [Summary and confidence statistics], [`{"summary": "...", "confidence": 0.96}`],
  ),
  caption: [Table 1. Core JSON documents and their intended consumers.]
)

Table footnote: assumes shared helper unified for naming; subsequent provider extension fields should preferentially go into report, not pollute main schema directly.

== Code Block & Quote

Code block below for testing PaddleOCR handling of monospace, command-line arguments, and long dashes.

```bash
python scripts/entrypoints/validate_document_schema.py \
  --adapt sample_layout.json \
  --write-report sample_report.json
```

Quote block for observing indentation, leading, and reference mark detection:

#quote(block: true)[
Note: Please be sure to first trigger regression_check, confirm provider fixture registered in registry,
then compare normalized document with raw provider JSON field differences.
]

== Display formulas and summary

Below display formula covers display math scenario:

$
N = (sum_(i = 1)^n c_i w_i) / (sum_(i = 1)^n w_i)
$

Append short Chinese and English summary to naturally end first page. First page intentionally contains mixed paragraph lengths, figure caption text, a table block, and a code block so OCR can expose block typing differences.

#pagebreak()

== Second page: Comprehensive example.

This page continues with image captions, table titles, numbered lists, alert box styling text, and longer body blocks. A longer paragraph is useful because PaddleOCR often changes segmentation strategy once line count and punctuation density increase. This also helps later splitting paragraph -> line -> token level 3 JSON.

=== Subsection A: Experiment Log

1. The experiment started at 08:30 with a synthetic document bundle.
2. Second step: record layout nodes and metadata boundary positions.
3. The final step compares raw provider spans against normalized segments.

=== Subsection B: Warning Message

#figure(
  rect(
    width: 100%,
    inset: 10pt,
    radius: 4pt,
    fill: rgb("#f7f1e3"),
    stroke: rgb("#c17c00"),
    [
*Warning.* If a block contains both table border and text content, retain raw geometry first,
then decide whether to normalize by splitting into `table` and `caption` two objects.
    ],
  ),
  caption: [Figure 2. A warning-style block that behaves like a callout.]
)

=== Subsection C: Small Data Table

Here we put a more academic table to test whether numbers, units, English abbreviations, and Chinese descriptions mix into same column.

#figure(
  table(
    columns: (20%, 18%, 24%, 38%),
    align: left + horizon,
    stroke: 0.4pt,
    inset: 5pt,
    [*Sample*], [*Pages*], [*Confidence*], [*Comment*],
    [Doc-A], [12], [0.97], [Mostly clean scientific article with equations.],
    [Doc-B], [2], [0.91], [Contains screenshots and heavy mixed language labels.],
    [Doc-C], [36], [0.88], [Code block and table border overlap need special handling.],
  ),
  caption: [Table 2. Example benchmark summary for provider comparison.]
)

Table note: Values illustrative only, do not represent actual benchmark conclusions.

=== Subsection D: Closing paragraph

This closing paragraph keeps a natural reading flow while still covering mixed punctuation, abbreviations such as API, OCR, PDF, and a final inline formula $p(x) = a x + b$. Append Chinese note: results for research only, convenient for you to later upload PDF to PaddleOCR service and cross-reference its JSON structure for split design.
