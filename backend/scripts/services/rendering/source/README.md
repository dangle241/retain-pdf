# rendering/source

## Responsibilities

Original PDF adaptation layer. Responsible for making the source PDF a base that can carry translations.

## Public entry point

- `render_source.py`
- `rects.py`
- `items.py`
- `document_ops.py`
- `redaction.py`
- `text_redaction.py`
- `vector_profile.py`
- `vector_text.py`
- `preparation/`
- `cleanup/`
- `background/`
- `compression/`
- `dev_overlay/`

## What not to do

- Do not generate Typst.
- Understood.
- No translation.
- Does not assume workflow Orchestration responsibilities.

## Boundary Conventions

- rects.py holds source layer-shared basic rectangle utilities. background/, cleanup/, preparation/ may rely on it.
  `cleanup/`、`preparation/` You can rely on it.
- items.py holds source layer-shared translated item reading, token segmentation, and text normalization helpers.
- document_ops.py holds source layer-shared PDF document operation primitives.
- redaction.py is the source layer facade for cleanup redaction strategy; do not access directly from external sub-packages.
  import `cleanup.redaction`。
- `text_redaction.py` place source Delete shared text layer primitive。
- vector_profile.py holds source layer-shared page vector drawing statistics primitives.
- vector_text.py holds source layer-shared vector text detection primitives; specific deletion and background repair are decided by cleanup/background execution layer.
  Background repair by cleanup/background Execution layer decides.
- `dev_overlay/` Old PyMuPDF Direct translation path, for use only. direct overlay and single-page debugging;
  Main render path avoid extending body typography rules here.
- Do not share a base between subpackages purely for sharing. geometry Mutual importWhen sharing needed, first move up to.
  `rects.py`。
