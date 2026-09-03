# Layout-Fit cross-page/Column-break issue description

## Symptom.

In the PDF overlay preview of `layout-fit/html/pretext.html`, some areas look close in single-box fitting, but obvious errors occur with cross-page or cross-column paragraphs:

- Bottom of page 3 and top of page 4 originally one paragraph, but reformatted as two separate blocks.
- Some blocks show the original English text instead of the Chinese translation.
- The auto-fitted height, line count, and line-break results appear "slightly off," but it is actually a systematic bias.

## Root Cause

Issue not single cause; multiple error layers compounded:

### 1. Misidentified cross-page continuation paragraph as standalone. block

Upstream translation [action] [preserve context]. Typst Split paragraph across pages. Use CSS `page-break-inside: avoid;` on container. item。

For example:

- `p003-b0005 -> p004-b0000`
- `p005-b0005 -> p006-b0000`
- `p007-b0004 -> p008-b0000`
- `p009-b0006 -> p010-b0000`

In Typst overlay Two independent ones here too. `pX_item_*`, not a naturally continuous flowing object.

But the old version. preview Still press 'One' sample = Text box "Process"

- Previous page footer only lays out the first half.
- Next page restarts layout from its own text.

This will prevent cross-page paragraphs from continuing correctly.

### 2. Translation JSON Partial continuation blocks lack translations.

For example:

- `p003-b0005`
- `p004-b0000`

Inside `translated/page-003-deepseek.json` and `translated/page-004-deepseek.json`, the `translated_text` of these two blocks is an empty string.

Thus, old logic falls back. `source_text`Page display English original. Verify locale settings.

### 3. `pretext` measurement units and PDF Mixed coordinate units

`pretext` measurement of </span><code>pretext</code><span class=""> is based on browser pixels, while PDF target box is `pt`The old implementation directly PDF `pt` Width & Height `pretext`, and then used the result as if it were in `pt` used back into overlay and scoring, causing:

- Line breaks unstable.
- Line Height and Height Scoring Deviation
- Looks like 'fitting not quite right'.

## Solution

### 1. Cross-page block Revert to flow group

In [extract_block_samples.py](/home/wxyhgk/tmp/Code/experiments/layout-fit/scripts/extract_block_samples.py), cross-page continuation detection was added.

- sequential scan OCR text block
- If previous block ends mid-word, next block starts lowercase or with continuation style, and they are adjacent across pages.
- Mark as same. `flow`

Then `flow` Write Information fixture：

- `group_id`
- `index`
- `count`
- `prev_block_id`
- `next_block_id`
- `block_ids`

Thus the frontend no longer treats these blocks as independent of each other.

### 2. Frontend: switch to multi-frame streaming; drop single-frame independent fitting.

In [pretext.html](/home/wxyhgk/tmp/Code/experiments/layout-fit/html/pretext.html), source text is missing. Provide Chinese text for translation.

- Belonging to the same `flow` Multiple box, first concatenate the text into a continuous paragraph
- Use `pretext.layoutNextLine()` to consume lines sequentially box by box
- Overflow content flows to next box.

This step fixes the fundamental cross-page and cross-column issue.

### 3. Fallback to Typst markdown text

Added to same extraction script for `*_md` parsing in Typst overlay.

If a certain block:

- `translated_text` Empty
- But Typst exists inside markdown_text

Just Typst Chinese text detected. Translate. Provide English text. markdown as translated_text / fit_text fallback source for.

This step fixes the issue of English text appearing at the bottom of page 3 and the start of page 4.

### 4. Unify pretext and PDF unit system of" – but "of" maybe part of the phrase. Could be "Unify pretext and PDF unit system". We'll keep as is: "### 4. Unify pretext and PDF unit system of

When frontend fitting, change to:

- Press First PDF For the page layout's pixel density, replace font size, width, and line height with pixels.
- Use pretext Layout in this pixel coordinate system.
- Swap the result back. PDF `pt` For scoring and overlay rendering.

This way, line breaks and PDF Overlay finally in the same coordinate system.

## Current effect

After fix:

- Chinese at bottom of page 3 and top of page 4.
- Both streams merge into single paragraph.
- Preview layer now recognizes and processes multiple cross-page continuation groups.

Identified spreads flow Includes:

- `p003-b0005 -> p004-b0000`
- `p005-b0005 -> p006-b0000`
- `p007-b0004 -> p008-b0000`
- `p009-b0006 -> p010-b0000`

## Lessons learned

Such issues cannot be solved merely by adjusting font size, line height, and justification.

If upstream translation/Layout splits paragraphs for engineering convenience.preview Layer must restore "paragraph flow" semantics; otherwise regardless `pretext` no matter how you tune, there will be structural errors in cross-page and cross-column scenarios.
