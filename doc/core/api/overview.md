# Service Overview

## Ports and entry points

- `40001`：Docker Deliver frontend page.
- 41000: Rust full API, includes upload, tasks, artifacts, provider validation, and other interfaces.
- 42000: multipart async submit API, mainly provides POST /api/v1/translate/bundle.
- `GET /health`Health check not required. `X-API-Key`。
- `/api/v1`Business API Prefix required `X-API-Key`。

Docker web default FRONT_API_BASE= empty; frontend same-origin proxies /api/ to backend; in local development, frontend falls back to current host's 41000.

## Main chain

Current async main flow:

1. POST /api/v1/uploads to upload PDF.
2. `POST /api/v1/jobs` Create main task.
3. Main task creates OCR subtask {job_id}-ocr.
4. OCR After completion, generate standardized output. `document.v1`。
5. enter translation and rendering.
6. Download artifacts via task details, actions, artifacts, or manifest.

Official Task JSON Only use grouping structures:

- `workflow`
- `source`
- `ocr`
- `translation`
- `render`
- `runtime`

`workflow` Currently supported:

- `book`：OCR -> Normalize -> Translate -> Render。
- `translate`：OCR -> Normalize -> Translate, does not enter rendering.
- render: rerun rendering based on existing task artifacts.

OCR-only uses standalone entry POST /api/v1/ocr/jobs, supports multipart upload and can reuse existing via request body source/artifact fields.

## Response Wrapper

Success response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

Error response:

```json
{
  "code": 40000,
  "message": "bad request"
}
```

Common error codes:

- `40000`Request error.
- `40100`Authentication failed.
- `40400`Resource not found.
- `40900`Status conflict.
- `50000`Internal service error.

Frontend will automatically unwrap `{code, message, data}`New API docs: keep this wrapper format.

## Frontend dependency priorities

Task details page not just dependencies `status`, it also reads:

- `stage` / `stage_detail` / `progress`
- `runtime.current_stage` / `runtime.stage_history`
- `actions.download_pdf` / `actions.open_markdown` / `actions.open_markdown_raw` / `actions.download_bundle` / `actions.cancel`
- `artifacts.pdf` / `artifacts.markdown` / `artifacts.bundle`
- `failure` / `failure_diagnostic` / `log_tail`

Download and button state should be `actions.*.enabled`、`artifacts.*.ready`、`artifacts-manifest.items[].ready` Prevails.

## Provider

Docker delivery default frontend OCR provider is paddle, but backend also supports:

- `mineru`
- `paddle`
- `deepseek` Credential Verification

Do not hardcode a specific provider as the only mainline in API documentation.
