# PaddleOCR Archive official docs.

Most relevant integration content for current repository. PaddleOCR Official documentation entry, unified from `doc/` Enter. No more searching in source directories.

## Official source

- PaddleOCR-VL Official user documentation:
  <https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/pipeline_usage/PaddleOCR-VL.md>
- PaddleOCR-VL Official online documentation:
  <https://www.paddleocr.ai/latest/version3.x/pipeline_usage/PaddleOCR-VL.html>

## Current repo focus

For this project, the key is not the full deployment guide, but these official facts:

1. layoutParsingResults[*].markdown.text is the officially returned Markdown body text.
2. layoutParsingResults[*].markdown.images is the Markdown image reference mapping.
3. Multiple Pages PDF Pass. `restructurePages` Cross-page refactoring.
4. `showFormulaNumber`、`prettifyMarkdown` Directly affects Markdown Output form.

## Repo cleanup draft

- Service Interface and Asynchronous Call Excerpts:
  [async_parse_official_excerpt.md](./async_parse_official_excerpt.md)

## Usage conventions

1. Stored here: repository-internal entry and curated excerpts of official documentation.
2. Integration implementation follows official field semantics, not historical compatibility logic.
3. If official documentation updates, update here first, then update the rest. provider Code and internal adaptation documentation.
