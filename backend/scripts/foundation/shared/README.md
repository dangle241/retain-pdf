# Shared Notes

`scripts/foundation/shared` Foundational capabilities all scripts depend on.

This layer does not do OCRShared logic centralizes common items. Avoid path env var default param repetition across scripts.

## Main file

- `config.py`
  Transition entry. Internal implementation has been split to `scripts/foundation/config/`New code should directly depend on the split modules.
- `input_resolver.py`
  Responsible for parsing the input directory into explicit. `source_json/source_pdf`。
- `job_dirs.py`
  Parses and validates standards. job Directory contract:`source/ocr/translated/rendered/artifacts/logs`。
- `local_env.py`
  Responsible for reading from explicit parameters, environment variables, or `scripts/.env/` Read secret key from file.
- `prompt_loader.py`
  Responsible from `scripts/foundation/prompts/` Load editable prompt template.
- `job_cleanup.py`
  Handles output directory cleanup logic.
- `stage_specs.py`
Responsible for Phase spec schema constants, JSON loader, and `credential_ref` parsing.

## Position in overall flow

`foundation/shared` It is the supporting layer for all layers:

- Stage worker / Orchestration layer uses it for parsing. specCredential reference and standard task directory
- OCR provider Implementation layer reads via it. tokenEnvironment setup output path
- Translation layer uses it to load prompts and default config.
- Rendering layer uses it to read font, compression, and layout parameters.
- Rust/Python Orchestration layer parses it. `job_root/specs/*.spec.json`

## Important convention

The current `config.py` part includes "process-level variable parameter tuning", e.g.:

- `BODY_FONT_SIZE_FACTOR`
- `BODY_LEADING_FACTOR`
- `INNER_BBOX_SHRINK_X/Y`

These parameters can be `apply_layout_tuning(...)` Override at runtime.

This pair CLI Very convenient, but that also means:

- When running multiple tasks sequentially in the same process, ensure parameters do not interfere with each other.
- If further decoupling continues, this layer is the primary area for further cuts.

## Stage Spec Credential convention

Current stage worker Unified to:

`python -u <entrypoint> --spec <job_root>/specs/<stage>.spec.json`

`stage_specs.py` Currently maintained schema Versions include:

- `normalize.stage.v1`
- `translate.stage.v1`
- `render.stage.v1`
- `provider.stage.v1`
- `book.stage.v1`

Additional conventions:

- spec is a stable data contract from Rust to Python, no longer dependent on long CLI flag concatenation.
- Do not hardcode keys. spec JSON
- spec only retains `credential_ref`
  - `env:RETAIN_TRANSLATION_API_KEY`
  - `env:RETAIN_MINERU_API_TOKEN`
- Python worker Approve All `resolve_credential_ref(...)` Retrieve actual value at runtime.
- Rust Invoked by main workflow. worker Current requirements `--spec`
- Local dev entry: unified pass-through, driven by stage spec.

## Usage recommendations

- Prioritize new code, view directly. `scripts/foundation/config/` Split config by responsibility.
- Don't concatenate strings yourself in upper-layer scripts. `output/<job-id>/...` Path first. `job_dirs.py`
- Python worker only consumes stage spec. No longer expose long business parameter entry points.
- If it's a stage worker, prefer to add new/consume schema in `stage_specs.py`, rather than continuing to expand CLI parameters
- Key reading must not be scattered in business code. Prefer a centralized path. `local_env.py`
- Do not hardcode prompts in business modules; prioritize externalization. `prompt_loader.py`
