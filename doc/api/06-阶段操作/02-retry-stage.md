# retry-stage

## Endpoint

```http
POST /api/v1/jobs/{job_id}/retry-stage
```

Used for user-initiated re-execution of subsequent steps from a specific phase.

## Request example

```json
{
  "stage": "translation",
  "mode": "from_stage",
  "create_new_job": true,
  "overrides": {
    "translation": {
      "model": "deepseek-v4-flash",
      "workers": 100
    },
    "render": {
      "compile_workers": 8
    }
  }
}
```

## Stage semantics

- ocr: reuse source PDF, rerun OCR -> translation -> render.
- translation: reuse source PDF + OCR result, rerun translation -> render.
- render: reuse source PDF + OCR result + translation, rerun only render.

## Response example

```json
{
  "job_id": "new-job-id",
  "source_job_id": "old-job-id",
  "status": "queued",
  "workflow": "book",
  "rerun_from_stage": "translation",
  "reused_artifacts": ["source_pdf", "ocr_result"],
  "rerun_stages": ["translation", "render"]
}
```

Frontend gets new `job_id` Then proceed to normal polling.

## Difference from resume

- `resume` Prefer recovery after failure.
- `retry-stage` User actively reruns from specified stage; successful tasks also usable.
