# Prompt file

Editable prompt texts for the main pipeline.

- `translation_system.txt`
  System prompt used for translation requests.
- `translation_task.txt`
  Task description concatenated into the translation user payload.
- `classification_system.txt`
  System prompt for `precise` full-page classification mode.

To adjust model behavior, edit here; do not hardcode prompts in Python.
