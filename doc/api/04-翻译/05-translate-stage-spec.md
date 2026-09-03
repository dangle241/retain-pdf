# translate.stage.v1

translate.stage.v1 is the stable internal contract for Rust API to start Python translation worker. External callers need not edit directly; understanding aids troubleshooting.

## Entry point

Rust Will start:

```bash
run_translate_only.py --spec <job_root>/specs/translate.spec.json
```

## Spec structure

```json
{
  "schema_version": "translate.stage.v1",
  "stage": "translate",
  "job": {
    "job_id": "20260616120000-abcdef",
    "job_root": "/data/jobs/20260616120000-abcdef",
    "workflow": "book"
  },
  "inputs": {
    "source_json": "/data/jobs/xxx/ocr/normalized/document.v1.json",
    "source_pdf": "/data/jobs/xxx/source/book.pdf",
    "layout_json": "/data/jobs/xxx/ocr/result.json"
  },
  "params": {
    "start_page": 0,
    "end_page": -1,
    "batch_size": 1,
    "workers": 100,
    "mode": "sci",
    "math_mode": "direct_typst",
    "skip_title_translation": false,
    "classify_batch_size": 12,
    "rule_profile_name": "general_sci",
    "custom_rules_text": "",
    "glossary_id": "",
    "glossary_name": "",
    "glossary_entries": [],
    "context_mode": "needed",
    "glossary_mode": "matched",
    "memory_mode": "matched",
    "model": "deepseek-v4-flash",
    "base_url": "https://api.deepseek.com/v1",
    "credential_ref": "env:RETAIN_TRANSLATION_API_KEY"
  }
}
```

## Security conventions

- API key Do not write. spec Plaintext.
- `credential_ref` Points to runtime environment variables.
- Rust worker Startup Injection `RETAIN_TRANSLATION_API_KEY`。

## Outputs

Translation worker on success will write:

- `translated/translation-manifest.json`
- Per-page translation payloads
- `artifacts/translation_diagnostics.json`
- `artifacts/translation_debug_index.json`
- `artifacts/translation_review.json`
- `artifacts/pipeline_summary.json`
