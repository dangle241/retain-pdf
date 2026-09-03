# OCR-only API Description

This document only describes. OCR-only Microservice interface.

Explanation:

- This is an OCR-only specialized instruction. Check the official API main entry first. [RetainPDF Backend API main entry](/home/wxyhgk/tmp/Code/doc/core/api/index.md). Run the main chain and see [CURRENT_API_MAP](/home/wxyhgk/tmp/Code/backend/rust_api/CURRENT_API_MAP.md)
- Current provider selection to view in request `provider` / `ocr.provider`; actual supported set subject to health checks and `OCR_PROVIDER_CONTRACT.md`

Its goal is clear:

- Only perform OCR parsing
- Only do raw OCR -> `document.v1.json` / `document.v1.report.json` standardization
- No translation performed.
- No Typst
- No PDF rendering

Current interfaces already mounted on existing. `rust_api` In the service, but logically independent. OCR Microservice Interface Family:

- `/api/v1/ocr/jobs`
- `/api/v1/ocr/jobs/{job_id}`
- `/api/v1/ocr/jobs/{job_id}/artifacts`
- `/api/v1/ocr/jobs/{job_id}/normalized-document`
- `/api/v1/ocr/jobs/{job_id}/normalization-report`
- `/api/v1/ocr/jobs/{job_id}/cancel`

The current example still uses `mineru` for main only. provider Example, not representative. OCR-only Protocol default binding MinerU。

This OCR-only Position of the process in the overall system:

1. OCR API Responsible for provider Finalize raw results. `document.v1`
2. Complete translation chain then upper layer. `normalize -> translate -> render` Main process continues consuming
3. OCR API neither a test script nor translation/Rendering entry point; it is part of the official production pipeline. normalize First half

Current `document.v1` formal consumption specification for downstream:

- `geometry`
- `content`
- `layout_role`
- `semantic_role`
- `structure_role`
- `policy`
- `provenance`

Compatibility Fields `type/sub_type/bbox/text/lines/segments` Can be retained, but should no longer be treated by downstream as the primary semantic entry point.

Internal Implementation Notes:

- `app/router.rs` handles mounting `/api/v1/ocr/jobs*` Routes
- `routes/jobs/create.rs` handles OCR `multipart/form-data` entry
- `routes/jobs/query.rs` / `routes/jobs/control.rs` / `routes/jobs/download.rs` Handles query, cancellation, and artifact download.
- `routes/job_requests.rs` handles OCR form parsing
- `routes/common.rs` / `routes/download_response/**` / `routes/job_helpers.rs` Responsible. Ensure. Next step. OCR / General job public response Download helper logic
- `services/jobs/facade.rs` Ensures stable service ingress.
- `services/jobs/creation.rs` and `services/jobs/creation/bundle.rs` handle OCR job build
- `services/job_validation.rs` handles provider parameter validation
- `services/job_snapshot_factory.rs` is responsible for snapshot / command assembly
- `services/job_launcher.rs` Executes startup.

If troubleshooting API behavior, refer to the responsibilities of these split modules, not the old centralized file structure.

## 1. Basic Info

- Service port:`41000`
- Base prefix:`/api/v1`
- Health check:`GET /health`
- Authentication method: request header. `X-API-Key`
- Response format: except for download endpoints, default return JSON

Request header example:

```http
X-API-Key: your-rust-api-key
```

Unified response format:

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

Note:

- `code=0` Success
- non- `0` Failed
- `message` Directly display to frontend.

## 2. OCR Task status

Total task status:

- `queued`
- `running`
- `succeeded`
- `failed`
- `canceled`

Common stages:

- `queued`
- `mineru_upload`
- `mineru_processing`
- `normalizing`
- `finished`
- `failed`
- `canceled`

Additional notes:

- `queued`Queued, waiting for execution slot.
- `mineru_upload`File uploaded to MinerUpending processing
- `mineru_processing`：MinerU Parsing
- `normalizing`Generating... `document.v1`
- `finished`：OCR + Standardization complete

## 3. Health check

`GET /health`

Return example:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "status": "up",
    "db": "ok",
    "queue_depth": 0,
    "running_jobs": 0,
    "provider_backends": ["mineru", "paddle"],
    "time": "2026-03-31T03:33:44Z"
  }
}
```

Field descriptions:

- `status`:`up` or `degraded`
- `db`：SQLite whether available
- `queue_depth`Queued tasks
- `running_jobs`Currently running tasks:
- `provider_backends`Currently connected: OCR provider

## 4. Create OCR Task

`POST /api/v1/ocr/jobs`

This is a `multipart/form-data` Interface.

Implementation details:

- Form field parsing in `routes/job_requests.rs`
- Create entry at `routes/jobs/create.rs`
- facade Close at `services/jobs/facade.rs`
- Pre-creation provider / token / URL / timeout Validate `services/job_validation.rs`
- OCR job snapshot build and startup are completed collaboratively by `services/jobs/creation.rs`, `services/job_snapshot_factory.rs` and `services/job_launcher.rs`

Two submission methods, choose one.

- Upload local PDF：`file`
- Push to remote PDF：`source_url`

### Required field

- `provider`
  Current common values:`mineru`；Other provider Current deployment enablements apply.
- `mineru_token`
  when `provider=mineru` Required when
- `timeout_seconds`
  OCR Total task timeout seconds

### Common optional fields

- `file`
- `source_url`
- `model_version`
- `is_ocr`
- `disable_formula`
- `disable_table`
- `language`
- `page_ranges`
- `data_id`
- `no_cache`
- `cache_tolerance`
- `extra_formats`
- `poll_interval`
- `poll_timeout`
- `job_id`

### Local file example

```bash
curl -X POST "http://127.0.0.1:41000/api/v1/ocr/jobs" \
  -H "X-API-Key: your-rust-api-key" \
  -F "provider=mineru" \
  -F "mineru_token=your-mineru-token" \
  -F "timeout_seconds=1800" \
  -F "model_version=vlm" \
  -F "file=@/path/to/paper.pdf"
```

### Remote URL Example

```bash
curl -X POST "http://127.0.0.1:41000/api/v1/ocr/jobs" \
  -H "X-API-Key: your-rust-api-key" \
  -F "provider=mineru" \
  -F "mineru_token=your-mineru-token" \
  -F "timeout_seconds=1800" \
  -F "source_url=https://example.com/paper.pdf"
```

### Response Example

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "job_id": "20260331033736-c2bcda",
    "status": "queued",
    "workflow": "ocr",
    "links": {
      "self_path": "/api/v1/ocr/jobs/20260331033736-c2bcda",
      "self_url": "http://127.0.0.1:41000/api/v1/ocr/jobs/20260331033736-c2bcda",
      "artifacts_path": "/api/v1/ocr/jobs/20260331033736-c2bcda/artifacts",
      "artifacts_url": "http://127.0.0.1:41000/api/v1/ocr/jobs/20260331033736-c2bcda/artifacts",
      "cancel_path": "/api/v1/ocr/jobs/20260331033736-c2bcda/cancel",
      "cancel_url": "http://127.0.0.1:41000/api/v1/ocr/jobs/20260331033736-c2bcda/cancel"
    }
  }
}
```

### Validation rules

- `provider` Must be supported by the current service. OCR provider
- When `provider=mineru`, `mineru_token` cannot be empty.
- When passed `mineru_token` When, it cannot be URL
- `source_url` If provided, must be `http://` or `https://` Start
- `timeout_seconds` Must be greater than `0`

## 5. OCR Task list

`GET /api/v1/ocr/jobs`

Supported parameters:

- `limit`
- `offset`
- `status`
- `provider`

Example:

```bash
curl -H "X-API-Key: your-rust-api-key" \
  "http://127.0.0.1:41000/api/v1/ocr/jobs?limit=20&offset=0&status=failed&provider=mineru"
```

Response example:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [
      {
        "job_id": "20260331033736-c2bcda",
        "workflow": "ocr",
        "status": "succeeded",
        "trace_id": "ocr-20260331033736-c2bcda",
        "stage": "finished",
        "created_at": "2026-03-31T03:37:36Z",
        "updated_at": "2026-03-31T03:37:41Z",
        "detail_path": "/api/v1/ocr/jobs/20260331033736-c2bcda",
        "detail_url": "http://127.0.0.1:41000/api/v1/ocr/jobs/20260331033736-c2bcda"
      }
    ]
  }
}
```

## 6. OCR Task details

`GET /api/v1/ocr/jobs/{job_id}`

Example:

```bash
curl -H "X-API-Key: your-rust-api-key" \
  "http://127.0.0.1:41000/api/v1/ocr/jobs/20260331033736-c2bcda"
```

In the details, focus on these fields:

- `status`
- `stage`
- `stage_detail`
- `trace_id`
- `provider_trace_id`
- `ocr_provider_diagnostics`
- `artifacts`

Note:

- `trace_id` is the OCR internal microservice link ID
- `provider_trace_id` is the provider return path ID
- `ocr_provider_diagnostics` For troubleshooting
- `ocr_provider_diagnostics.artifacts` Place only provider transport/raw Artifacts and normalize Artifact path summary, not expanded directly. `document.v1` Internal Field

Boundary conventions:

- provider Original state, errorraw bundle Information retained in `ocr_provider_diagnostics`
- `document.v1.json` / `document.v1.report.json` Still the downstream main contract.
- Don't skip provider Private fields directly stuffed into `document.v1`

## 7. Fetch artifact index

`GET /api/v1/ocr/jobs/{job_id}/artifacts`

This API is OCR One of the most important interfaces in microservices.

Returns the artifact indices downstream actually cares about.

Return highlights:

- `schema_version`
- `provider_raw_dir`
- `provider_zip`
- `provider_summary_json`
- `normalized_document`
- `normalization_report`

Actual example field structure:

```json
{
  "schema_version": "document.v1",
  "provider_raw_dir": "output/20260331033736-c2bcda/ocr/unpacked",
  "provider_zip": "output/20260331033736-c2bcda/ocr/mineru_bundle.zip",
  "provider_summary_json": "output/20260331033736-c2bcda/ocr/mineru_result.json",
  "normalized_document": {
    "ready": true,
    "path": "/api/v1/ocr/jobs/20260331033736-c2bcda/normalized-document"
  },
  "normalization_report": {
    "ready": true,
    "path": "/api/v1/ocr/jobs/20260331033736-c2bcda/normalization-report"
  }
}
```

Field semantics:

- `provider_raw_dir`
  provider Original unpacked directory
- `provider_zip`
  provider Original zip
- `provider_summary_json`
  provider Raw return result
- `normalized_document`
  Standardized `document.v1.json`
- `normalization_report`
  Standardization Report `document.v1.report.json`

Supplementary note:

- `provider_summary_json` / `provider_zip` / `provider_raw_dir` Belongs to provider raw artifacts
- `normalized_document` / `normalization_report` belong to normalized artifacts
- These two layers need to be retained simultaneously; the former is used for arrangement. OCR provider question, the latter used for troubleshooting `document_schema` Compatibility Issues

## 8. Standardize download OCR Result

### Download `document.v1.json`

`GET /api/v1/ocr/jobs/{job_id}/normalized-document`

### Download `document.v1.report.json`

`GET /api/v1/ocr/jobs/{job_id}/normalization-report`

Purpose:

- `document.v1.json` Directly consumed by translation mainline.
- `document.v1.report.json` Troubleshooting, frontend diagnostics,schema Check usage

## 9. Cancel OCR Task

`POST /api/v1/ocr/jobs/{job_id}/cancel`

Example:

```bash
curl -X POST \
  -H "X-API-Key: your-rust-api-key" \
  "http://127.0.0.1:41000/api/v1/ocr/jobs/20260331033736-c2bcda/cancel"
```

Current Cancellation Rules:

- Cancel if task still queued.
- If the task is still in the provider phase, stop subsequent polling.
- If the task has already entered `normalizing`Will complete current first. normalizeDiscard normalized outputs, then mark. `canceled`

## 10. Current directory persistence convention

Using task `20260331033736-c2bcda` as an example:

```text
output/20260331033736-c2bcda/
├── source/
│   └── font_test.pdf
└── ocr/
    ├── mineru_result.json
    ├── mineru_bundle.zip
    ├── unpacked/
    └── normalized/
        ├── document.v1.json
        └── document.v1.report.json
```

Note:

- `source/`Missing source. Paste text. PDF
- `ocr/unpacked/`：provider Unpack raw content.
- `ocr/normalized/`Standardized result for main pipeline consumption.

## 11. Current limits and boundaries

Current set OCR Microservice interface operational. `provider raw -> document.v1`。

But note:

- The current provider is more than `mineru`, but the provider sets enabled on different deployments may differ.
- Rust Our side already responsible. MinerU / Paddle provider transport submission, polling, result download, or raw Write artifacts to disk.
- The Python side remains responsible for normalizing raw OCR -> `document.v1.json`, and subsequent translate / render workers
- Rust Also responsible:
  - HTTP API
  - Task Status
  - Paged List
  - trace_id
- Cancel/timeout
  - artifacts Index

## 12. Recommended integration method

If later you want the main system to integrate this. OCR Microservices: fixed order recommended:

1. `POST /api/v1/ocr/jobs`
2. `GET /api/v1/ocr/jobs/{job_id}`
3. `GET /api/v1/ocr/jobs/{job_id}/artifacts`
4. Download
   - `/normalized-document`
   - `/normalization-report`

Don't read main system directly. provider raw JSON。

Primary system consume first.

- `document.v1.json`
- `document.v1.report.json`
- `schema_version`
- `trace_id`
- `provider_trace_id`

This way, subsequent replacements OCR provider Translation and rendering mainline need not be changed together.
