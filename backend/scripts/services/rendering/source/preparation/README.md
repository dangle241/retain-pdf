# rendering/source/preparation

## Responsibilities

Before rendering PDF Preprocessing layer. Only generic is retained. PDF Preprocessing capabilities, e.g., hidden text layer stripping,
Formula redaction Reply and XObject Clean up.

bbox text strip Migrated to `services.rendering.source_cleanup`. Do not in this directory
re-add bbox strip Planning, hit detection, or content stream rewriting logic.

## Public entry point

- `hidden_text_strip.py`
- `redact_restore_formula.py`
- `xobject_sanitize.py`

## Boundary with source_cleanup

- source_cleanup/planning is responsible for generating deletion candidates and protected areas from translated items.
- source_cleanup/pdf is responsible for pikepdf content stream deletion and Form XObject recursion.
- `source_cleanup/executor.py` Called by the rendering pipeline. source cleanup Entry.
- If this directory needs to be called. bbox stripOnly via `source_cleanup` Package entry – do not use directly.
  import internally planning/pdf Module.

## What not to do

- Do not finalize redaction。
- Do not generate Typst.
- Do not modify translation. payload。
- Do not add bbox text strip rules with incorrect precedence. Correct order: services.rendering.policy or
  `services.rendering.source_cleanup` Corresponding layer.
