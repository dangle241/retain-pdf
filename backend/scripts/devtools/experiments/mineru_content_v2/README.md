# MinerU `content_list_v2` Adaptation experiment

This experimental route converts MinerU's `content_list_v2.json` into a more structured intermediate JSON,
Facilitates subsequent translation and rendering research.

Isolated from stable mainline. Not default entry.

Current suggestion:

- Primary route use priority. `ocr/normalized/document.v1.json`
- `ocr/unpacked/layout.json` Keep only for adapterDebug and trace.
- `content_list_v2.json` Only for finer-grained text./Formula Structure Experiment

## Input

- `output/<job-id>/ocr/unpacked/content_list_v2.json`

## Print output.

The output is a normalized version of JSONmainly includes:

- Page List
- Normalized block structure
- Flattened text blocks and their `segments`
- non-text blocks retain original MinerU payload

## How to Run

```bash
python scripts/devtools/experiments/mineru_content_v2/adapt_content_list_v2.py \
  --input output/<job-id>/ocr/unpacked/content_list_v2.json \
  --output output/<job-id>/ocr/mineru_content_v2_adapted.json
```

## Current coverage

- Support `title`、`paragraph`、`list`、`page_header`、`page_footer`、`page_number`
- `image`、`table`、`equation_interline` will be kept as non‑translatable blocks
- MinerU's list items expand into separate normalized blocks.

## Known limitations

- Line-by-line geometry reconstruction not yet performed.
- list item reuses parent list's bbox, because MinerU input does not provide per-item bbox
- Currently not recommended as default. MinerU Access Route
