# RetainPDF API Wiki

This documentation is for frontend, desktop, and third-party integrators, and describes RetainPDF External Backend HTTP API stable contract.

`backend/rust_api/API_SPEC.md` Retained as backend engineering specification and implementation memo; directory split by usage scenario, read first for integration and debugging. Wiki。

## Basic info

- Base URL: `/api/v1`
- Health Check: `GET /health`
- except `/health` External: interface defaults require. `X-API-Key`
- All endpoints default to return, except file download endpoints. JSON Wrapper object

## Quick access

- Response format
- Authentication and errors
- Create task
- Query task details
- Task list
- Event overview
- display_stage and lane
- OCR Provider list
- OCR-only tasks
- local_command plugin
- remote_command plugin
- Translation parameters
- Concurrency and batching
- Glossary
- Context, terminology, memory modes
- translate.stage.v1
- Translation workflow
- Translation events
- Stage actions overview
- Stage retry
- Download overview
- Failure structure
- Translation debug API

## Current API partition

### Tasks

- `POST /api/v1/jobs`
- `GET /api/v1/jobs`
- `GET /api/v1/jobs/{job_id}`
- `POST /api/v1/jobs/{job_id}/cancel`
- `POST /api/v1/jobs/{job_id}/rerun`

### OCR

- `POST /api/v1/ocr/jobs`
- `GET /api/v1/ocr/jobs/{job_id}`
- `GET /api/v1/ocr/jobs/{job_id}/events`
- `GET /api/v1/ocr/jobs/{job_id}/artifacts`
- `GET /api/v1/ocr/jobs/{job_id}/artifacts-manifest`
- `GET /api/v1/ocr/jobs/{job_id}/normalized-document`
- `GET /api/v1/ocr/jobs/{job_id}/normalization-report`
- `POST /api/v1/ocr/jobs/{job_id}/cancel`
- `GET /api/v1/providers/ocr`

### Events and diagnostics

- `GET /api/v1/jobs/{job_id}/events`
- `GET /api/v1/jobs/{job_id}/diagnostics`
- `GET /api/v1/jobs/{job_id}/translation/diagnostics`
- `GET /api/v1/jobs/{job_id}/translation/items`
- `GET /api/v1/jobs/{job_id}/translation/items/{item_id}`
- `POST /api/v1/jobs/{job_id}/translation/items/{item_id}/replay`

### Stage operations

- `GET /api/v1/jobs/{job_id}/resume-plan`
- `POST /api/v1/jobs/{job_id}/resume`
- `GET /api/v1/jobs/{job_id}/stage-actions`
- `POST /api/v1/jobs/{job_id}/retry-stage`

### Download artifacts

- `GET /api/v1/jobs/{job_id}/artifacts`
- `GET /api/v1/jobs/{job_id}/artifacts-manifest`
- `GET /api/v1/jobs/{job_id}/artifacts/{artifact_key}`
- `GET /api/v1/jobs/{job_id}/pdf`
- `GET /api/v1/jobs/{job_id}/pdf/side-by-side`
- `GET /api/v1/jobs/{job_id}/cover`
- `GET /api/v1/jobs/{job_id}/thumbnail`
- `GET /api/v1/jobs/{job_id}/preview/pages/{page}`
- `GET /api/v1/jobs/{job_id}/markdown`
- `GET /api/v1/jobs/{job_id}/markdown/document`
- `GET /api/v1/jobs/{job_id}/markdown/images/{path}`
- `GET /api/v1/jobs/{job_id}/download`

## Frontend read principles

- Main state reads display_stage first, do not regex-guess phase from message or stage_detail.
- Read sub-stage first. `substage`。
- Main branch read-only `lane=main` Event or detail snapshot.
- `lane=background` For background preprocessing, warm-up, caching, and other auxiliary states only.
- message and stage_detail are for human display only, not business logic.
- Prefer files and images for display. API Returned URLDo not directly concatenate local file paths.
