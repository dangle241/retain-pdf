# OCR-only tasks

## Define purpose. Input/output? Auth?

```http
POST /api/v1/ocr/jobs
```

For executing only OCR provider and generating normalized document, without entering translation and rendering.

## Query endpoint

```http
GET /api/v1/ocr/jobs/{job_id}
GET /api/v1/ocr/jobs/{job_id}/events
GET /api/v1/ocr/jobs/{job_id}/artifacts
GET /api/v1/ocr/jobs/{job_id}/artifacts-manifest
GET /api/v1/ocr/jobs/{job_id}/normalized-document
GET /api/v1/ocr/jobs/{job_id}/normalization-report
POST /api/v1/ocr/jobs/{job_id}/cancel
```

## Request Highlights

OCR-only workflow semantics fixed to ocr, OCR provider still decided by ocr.provider.

## Artifacts

On success, core deliverables:

- `source_pdf`
- `provider_result_json`
- `provider_raw_dir`
- `normalized_document_json`
- `normalization_report_json`

Among these, normalized_document_json is the sole source to be consumed for subsequent translation and rendering, the OCR middle contract.
