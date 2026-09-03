# Golden PDF Sample directory

Place RetainPDF true PDF Regression samples here.

These PDFs are for verification of OCRTranslation stability, rendering stability, especially:

- Editable paper PDF
- Multi-column paper PDF
- Many formulas. PDF
- Image Scan PDF
- White on black PDF
- Programming/Technical Manual PDF
- Bookmarked PDF

## Placement rules

PDF Place file directly in current directory.

Recommended file name:

```text
editable-paper-formula.pdf
scan-image-only.pdf
dark-background.pdf
programming-manual.pdf
bookmarks.pdf
multi-column-paper.pdf
```

Filenames: only English, digits, hyphens, underscores. Avoid spaces, Chinese.

## Manifest

After adding PDF, add a line to `manifest.csv` stating the primary risks covered by this sample.

Field description:

- `id`Stable Sample ID。
- `file`: PDF filename.
- `category`Sample type.
- `pages`Approx. page count.
- `focus`Main regression points.
- `notes`Supplementary notes.

## Git Convention

Default: not recommended to put large. PDF Submit GitLocal directory for local development./CI Private Sample Entry.

If submitting small public samples later, keep each file under 1 MB within, and confirm copyright permission.

## Local regression script

Run completely. OCR, translation, rendering:

```bash
RETAIN_TRANSLATION_API_KEY=... python3 backend/scripts/devtools/run_golden_flow.py \
  --sample-id editable-paper-formula
```

View available samples:

```bash
python3 backend/scripts/devtools/run_golden_flow.py --list-samples
```

Validate only sample list:

```bash
python3 backend/scripts/devtools/run_golden_flow.py --check-manifest
```

Reuse existing job Perform check:

```bash
python3 backend/scripts/devtools/run_golden_flow.py \
  --job-root data/jobs/<job-id> \
  --skip-run
```

Script checks:

- No non-whitelist items in translation diagnosis unresolved items.
- Final PDF exists and page count matches source PDF.
- Sampled item Typst Place coordinates and OCR bbox Top-left alignment, default checked. `p001-b013`.
