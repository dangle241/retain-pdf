# Frontend status smoke check

The goal of this check is not to "take screenshots of the frontend pages", but to automatically verify:

- Upload successful.
- `/api/v1/jobs` Submitted successfully?
- During task detail polling, does the frontend status label advance as expected?

Current script location:

- `frontend/scripts/frontend-status-smoke.mjs`

Current npm entry:

```bash
cd frontend
npm run smoke:status -- --file ../data/temPDF/test1.pdf
```

Repository-level fixed entry:

```bash
./.github/scripts/smoke_frontend_status.sh
```

By default, writes latest results to:

```text
doc/ops/reports/frontend-status-smoke-latest.json
```

## Default behavior

Script automatically fetches configuration in the following order:

1. Command-line arguments
2. Environment variables
3. `frontend/runtime-config.local.js`
4. `backend/scripts/.env/*.env`

Default read:

- API Base: `frontend/runtime-config.local.js` / `frontend/runtime-config.js`
- `X-API-Key`: `frontend/runtime-config.local.js`
- Paddle token: `backend/scripts/.env/paddle.env`
- MinerU token: `backend/scripts/.env/mineru.env`
- Translation API key: backend/scripts/.env/deepseek.env

## Common examples

Run all `book` Process:

```bash
cd frontend
npm run smoke:status -- --file ../data/temPDF/test1.pdf
```

Specify Paddle:

```bash
cd frontend
npm run smoke:status -- \
  --file ../data/temPDF/test1.pdf \
  --ocr-provider paddle
```

Run from repo root directly:

```bash
./.github/scripts/smoke_frontend_status.sh data/temPDF/test1.pdf --ocr-provider paddle
```

Run translation only, skip rendering:

```bash
cd frontend
npm run smoke:status -- \
  --file ../data/temPDF/test1.pdf \
  --workflow translate \
--expect-labels "OCR in progress, translating, processing complete"
```

Specify endpoint and timeout:

```bash
cd frontend
npm run smoke:status -- \
  --file ../data/temPDF/test1.pdf \
  --api-base http://127.0.0.1:41000 \
  --max-wait-ms 3600000
```

Output JSON:

```bash
cd frontend
npm run smoke:status -- \
  --file ../data/temPDF/test1.pdf \
  --json
```

## Highlight key points.

Script prints each state change, e.g.:

```text
2026-04-25T14:00:00.000Z | running | OCR in progress | Completed page 3/12 OCR
2026-04-25T14:00:20.000Z | running | Translating | Completed batch 5/18 translation
2026-04-25T14:01:10.000Z | running | Rendering | Completed page 9/12 page rendering
2026-04-25T14:01:30.000Z | succeeded | Processing complete | Processing complete
```

Summary at end.

- `job_id`
- `final_status`
- `observed_labels`
- `missing_labels`
- `event_count`

If expected labels are missing, or the task ultimately is not `succeeded`, the script will return non- 0 Exit code.

## Pin report

Repository-level scripts will write:

- `doc/ops/reports/frontend-status-smoke-latest.json`

Report contains:

- `jobId`
- `finalStatus`
- `observedLabels`
- `missingLabels`
- `observations`
- `eventSamples`

## Applicable boundaries

This set smoke Frontend state mapping chain verify

- Backend output? job detail
- What label does frontend state normalization logic produce?
- Do these tags actually appear in the real workflow?

It does not validate browser layout, component animations, button visibility, or other such pure UI Details. If that part needs supplementing later, add separately. Playwright。
