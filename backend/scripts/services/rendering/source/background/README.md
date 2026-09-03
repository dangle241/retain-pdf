# rendering/source/background

## Responsibilities

Background processing layer: large background detection, image extraction, local reconstruction, page overlay.

## Public entry point

- `detect.py`
- `extract.py`
- `fill.py`
- `patch.py`
- `config.py`
- `sampling.py`
- `stage.py`
- `redaction_items.py`

## What not to do

- Do not determine the layout of translated text.
- Text layer deletion strategy not executed.
- Do not call Typst compile.
- Do not replace `page_profile/` Add global page categorization.
- Not from `source.cleanup` Use background reconstruction parameters or sampling. helper; parameters for background image paths are placed in
  Within this directory.
