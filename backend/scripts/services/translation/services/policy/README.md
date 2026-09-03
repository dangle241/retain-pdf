# Policy description

`scripts/services/translation/policy/` Official implementation directory for the translation strategy layer.

Includes:

- `config.py`
  Mode configuration, skip strategy, domain inference entry.
- `flow.py`
  Actually apply the strategy. payload Process entry point.
- `body_text_filter.py`
  Body noise and narrow block filtering logic.
- `metadata_filter.py`
  Metadata fragment filter logic: author lines, copyright lines, edit info, etc.

## Design principles

- New code starts from `services.translation.services.policy.*` Import.
- Strategy layer only processes payload Level determination, do not touch directly. PDF Or render.
