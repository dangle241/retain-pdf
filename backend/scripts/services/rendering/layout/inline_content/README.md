# Inline Content Rendering description

`services/rendering/layout/inline_content/` Own one thing.

With formula,Markdown、Typst inline Arrange the translated content text into a layout-stage usable format.

Not responsible here:

- OCR Formula Detection
- Translation model call
- PDF Page Layout
- Typst Compile Entire Page

It's just a small module in the rendering chain, responsible for how formula text enters the main rendering pipeline.

## Current design principles

This section now split along two tracks:

- `core/`
  Main chain. Only include logic executed during normal rendering.
- `fallback/`
  Fallback chain. Legacy compatibility.placeholder Cross-page continuationLaTeX-ish Patch, Formula PNG Render.

Don't use it anymore. `shared/`、`modes/` Semantically vague directory names.

## Current directory

```text
layout/inline_content/
  README.md
  __init__.py
  mode_router.py
  core/
    __init__.py
    inline_math.py
    markdown.py
  fallback/
    __init__.py
    latex_normalizer.py
    placeholder_markdown.py
    png_renderer.py
```

## Context missing. Define "main chain" (blockchain, Git, supply chain). Specify platform/goal.

Current default approach:

1. From upstream `protected_text`、`formula_map`、`math_mode`
2. `mode_router.py` Choose which path to take.
3. If it is `direct_typst`
   Proceed `core/inline_math.py` + `core/markdown.py`
4. If `placeholder`
   go `fallback/placeholder_markdown.py`
5. final output markdown/plain-text, handing over to layout / typst / redaction

That is:

- `mode_router.py` Distribution only
- `core/` Responsible for main chain text organization.
- `fallback/` Responsible for legacy path and fallback capability.

## File responsibility

### `mode_router.py`

Sole responsibility: based on `math_mode` Select path.

Now only do:

- `item_render_math_mode`
- `is_direct_typst_math_mode`
- `build_render_markdown`
- `build_item_render_markdown`

Should not clutter here with formula cleanup details.

### `core/inline_math.py`

Responsible for inline math lightweight level processing.

Mainly:

- Identify existing `$...$`
- Perform text replacement on non-mathematical fragments only.
- `direct_typst` Minimal compatibility sanitization in mode.
- Add necessary spaces to inline formulas.

here should remain lightweight, do not stuff placeholder logic.

### `core/markdown.py`

Responsible for main chain markdown Text Construction.

Mainly:

- Build renderable from plain text markdown
- do inline math Promote
- Handle citation-like text
- Provide plain-text build assistant

Here represents "the formula text rule that the current main path truly intends to preserve".

### `fallback/placeholder_markdown.py`

Mock failure for debugging. placeholder Formula path.

Input is usually:

- `protected_text`
- `formula_map`

Responsibilities:

- Split text by token
- Backfill formula using formula_map
- If necessary, place citation restore to plain text
- Finally call the main chain's markdown Text cleanup

If completely removed in the future placeholder, this file will continue to shrink.

### `fallback/latex_normalizer.py`

Responsible for legacy LaTeX-ish Formula patch.

Not a main chain core capability; a compatibility layer:

- Fix common OCR Noise.
- Handle legacy formats
- to placeholder / PNG fallback More stable input

If a rule only serves legacy data, do not include it in `core/`.

### `fallback/png_renderer.py`

Converts a single formula to PNG。

This capability is mainly for:

- Redaction path
- Fallback path for formulas that cannot be rendered directly as text.

It does not represent the main chain.

Main flow still prioritizes text. / direct typstinstead of converting all formulas into images.

## Dependency direction

This layer must follow dependency direction below:

- `mode_router -> core`
- `mode_router -> fallback`
- `fallback -> core`
- `core` Do not reverse-depend. `fallback`

That is:

- `core` Only for truly low-level, stable, main-chain components.
- `fallback` Callable `core`
- Cannot allow `core` again import back `fallback`

Otherwise, directories split but still coupled in practice.

## Public API surface.

External modules should generally only depend on these stable interfaces:

- `services.rendering.layout.inline_content.mode_router`
- `services.rendering.layout.inline_content.core.markdown`
- `services.rendering.layout.inline_content.core.inline_math`
- `services.rendering.layout.inline_content.fallback.placeholder_markdown`
- `services.rendering.layout.inline_content.fallback.latex_normalizer`
- `services.rendering.layout.inline_content.fallback.png_renderer`

Stop referencing deleted legacy paths, such as:

- `services.rendering.formula.*` Old path deleted. Do not use.
- `services.rendering.layout.inline_content.math_utils`
- `services.rendering.layout.inline_content.normalizer`
- `services.rendering.layout.inline_content.typst_formula_renderer`
- `services.rendering.layout.inline_content.shared.*`
- `services.rendering.layout.inline_content.modes.*`

## Suggested changes

If modifying this later, evaluate in this order:

1. Is this mandatory logic on the main path?
   If yes, prioritize. `core/`
2. Is this a placeholder / old LaTeX / PNG fallback / for historical compatibility?
   If yes, place. `fallback/`
3. Is this a path selection?
Place in mode_router.py
4. Is this a test failure case?
Place in
   [`devtools/tests/translation/test_formula_math_markers.py`](/home/wxyhgk/tmp/Code/backend/scripts/devtools/tests/translation/test_formula_math_markers.py)

## The file you should read right now

For quick understanding, suggested reading order:

1. [`mode_router.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/layout/inline_content/mode_router.py)
2. [`core/markdown.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/layout/inline_content/core/markdown.py)
3. [`core/inline_math.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/layout/inline_content/core/inline_math.py)
4. [`fallback/placeholder_markdown.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/layout/inline_content/fallback/placeholder_markdown.py)
5. [`fallback/latex_normalizer.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/layout/inline_content/fallback/latex_normalizer.py)
6. [`fallback/png_renderer.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/layout/inline_content/fallback/png_renderer.py)

## Current status

The current completed work is:

- `direct_typst` Main chain and placeholder Separate fallback chains
- `shared/`、`modes/` Fake boundary removed.
- core and fallback circular import removed.

The remaining non-logical issues are:

- Also in directory. `.ipynb_checkpoints`
- Directory still has __pycache__

These do not affect runtime but impact readability; can be removed later.
