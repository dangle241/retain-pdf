# Orchestration description

`scripts/services/translation/core/orchestration` Responsible for OCR payload Complete orchestration metadata.

It neither directly translates nor directly renders; its role is to take the original OCR Organize blocks into an intermediate state more suitable for translation and typesetting.

## Main files

- `zones.py`
  Page layout analysis, identify single column./Two-column and layout area.
- `units.py`
  Generate and Organize `translation_unit_id`、`skip_reason` Standard fields, etc.
Cross-page continuation review has been moved to services/continuation/orchestrator.py; layout layer keeps pure layout and metadata only.

## Position in overall flow

ocr payload -> orchestration -> translation policy / continuation / translation unit -> translation
