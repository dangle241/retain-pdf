# Translation Promptfoo Debug

This scaffolding's goal is not to rerun the entire book, but to take "a certain translation item Why it wasn't translated / Downgrade / Output dirty. Converge to minimal closed loop: reproducible, comparable, auto-regression.

The current chain is divided into three layers:

- Rust API Debug Interface
  - `GET /api/v1/jobs/{job_id}/translation/diagnostics`
  - `GET /api/v1/jobs/{job_id}/translation/items`
  - `GET /api/v1/jobs/{job_id}/translation/items/{item_id}`
  - `POST /api/v1/jobs/{job_id}/translation/items/{item_id}/replay`
- Python single item replay
  - `backend/scripts/devtools/replay_translation_item.py`
- Promptfoo fixture/eval
  - under current directory `scan_drift.py`、`capture_case.py`、`run_eval.py`、`promptfooconfig*.yaml`

## 1. Pinpoint exact location first. item

When starting the local API, first see:

```bash
curl -H 'X-API-Key: retain-pdf-desktop' \
  'http://127.0.0.1:41000/api/v1/jobs/<job_id>/translation/items?final_status=kept_origin&q=protocol'
```

If you don't want to handwrite. curlor directly use:

```bash
python backend/scripts/devtools/translation_debug_api.py \
  items \
  --job-id <job_id> \
  --final-status kept_origin \
  --q protocol
```

Or view individually. item：

```bash
curl -H 'X-API-Key: retain-pdf-desktop' \
  'http://127.0.0.1:41000/api/v1/jobs/<job_id>/translation/items/<item_id>'
```

```bash
python backend/scripts/devtools/translation_debug_api.py \
  item \
  --job-id <job_id> \
  --item-id <item_id>
```

To directly replay the current translation chain:

```bash
python backend/scripts/devtools/translation_debug_api.py \
  replay \
  --job-id <job_id> \
  --item-id <item_id>
```

## 2. Scan first. saved vs replay Policy drift

```bash
python backend/scripts/devtools/promptfoo/scan_drift.py \
  --job-root 20260415003317-c856fe \
  --saved-final-status kept_origin \
  --limit 10
```

Defaults to:

- First by saved side `final_status=kept_origin` migrated from
- Match candidate item One by one replay
- output items where policy drift occurs

If you want to replay Output all passed candidates:

```bash
python backend/scripts/devtools/promptfoo/scan_drift.py \
  --job-root 20260415003317-c856fe \
  --saved-final-status kept_origin \
  --all
```

## 3. Record bad examples as fixture

```bash
python backend/scripts/devtools/promptfoo/capture_case.py \
  --job-root 20260416034152-d12925 \
  --item-id p006-b014 \
  --description 'page6 red-shift paragraph untranslated' \
  --expected-contains Redshift \
  --expected-contains Fluorescence \
  --required-term 551\ nm
```

Writes by default:

- `backend/scripts/devtools/promptfoo/fixtures/cases.csv`
- `backend/scripts/devtools/promptfoo/fixtures/cases/<job>--<item>.json`

This JSON case artifact is the per-case fixture used to record and replay a single promptfoo scenario. It contains:

- saved item Snapshot
- current replay result
- policy_before / policy_after
- drift summary

If you only want to record this time saved Side, do not trigger. replay：

```bash
python backend/scripts/devtools/promptfoo/capture_case.py \
  --job-root 20260416034152-d12925 \
  --item-id p006-b014 \
  --description 'page6 red-shift paragraph untranslated' \
  --skip-replay
```

CSV Use in multi-value field `||` Separate so that multiple people can directly edit the table:

- `expected_contains`
- `required_terms`
- `forbidden_substrings`

## 4. run promptfoo

Prerequisites:

- Python Just use the current repository environment directly
- `promptfoo` need `Node 20.20+` or `22.22+`

`run_eval.py` will prioritize using the current shell's `node`. If the current version is insufficient, but a compatible version in `~/.nvm/versions/node` is already installed, it switches automatically. No manual action needed. `nvm use`.

Evaluate current only replay output:

```bash
python backend/scripts/devtools/promptfoo/run_eval.py
```

Also view 'Current'. replayCompare "original task output on disk"

```bash
python backend/scripts/devtools/promptfoo/run_eval.py --compare
```

If you only want to verify first. fixture And assertion chain, do not call the model:

```bash
python backend/scripts/devtools/promptfoo/run_eval.py --saved-only
```

The underlying layer actually executes:

```bash
npx promptfoo@latest eval -c backend/scripts/devtools/promptfoo/promptfooconfig.yaml
```

`run_eval.py` Automatically:

- Check if fixture is empty?
- inject `PROMPTFOO_PYTHON` Point to current Python
- inject fixture path into `PROMPTFOO_TRANSLATION_FIXTURES`

## Assertion rules

Current fixture supports several hard rules by default:

- Minimum length.
- whether Chinese must appear
- must‑include translation phrases
- Terms to preserve.
- Disallowed profane output snippets.
- `$...$` / `$$...$$` Chưa có bản dịch để so sánh. Gửi source + bản dịch cần kiểm tra.

These rules are all in:

- `backend/scripts/devtools/promptfoo/assertions.py`

## GitHub CI

Repository now directly connectable. GitHub Actions runs `current-replay`.

Corresponding workflow:

- `.github/workflows/translation-replay.yml`

Design has two layers:

- Run local unit tests first.
  - `test_promptfoo_case_tools.py`
  - `test_promptfoo_harness_regressions.py`
  - `test_translation_debug_tools.py`
- Run actual again. promptfoo current-replay
  - `python backend/scripts/devtools/promptfoo/run_eval.py`

### Missing context. Provide source text or code snippet to explain "why". GitHub CI does not depend on `data/jobs/`

GitHub runner checkout Default cannot access your local. `data/jobs/...` Working directory, so case artifact Will now also freeze:

- translate spec key parameters
- Complete corresponding page translated payload

This way CI on the runner has no such file. Job contents, also directly from:

- `backend/scripts/devtools/promptfoo/fixtures/cases/*.json`

Re-run current replay Source text missing. Provide source to translate.

### Required GitHub Secret

Required:

- `RETAIN_TRANSLATION_API_KEY`

Purpose:

- Tune model for current-replay provider

fork PR Unavailable by default. secretso workflow Yes:

- Still run local unit tests
- Skip current-replay eval that requires secret

### Artifact

workflow Will upload:

- current replay of promptfoo JSON results
- current fixture CSV
- case artifact JSON
- `~/.promptfoo/logs/*.log`

## Applicability boundary.

This toolset prioritizes “translation strategy". / fallback / keep-origin / prompt / provider "Output exception" issue.

It does not directly address:

- OCR Block extraction error
- continuation Concatenation error
- Typst Layout error

But you can use this set to quickly determine: whether the issue occurs "before translation" or "after translation".
