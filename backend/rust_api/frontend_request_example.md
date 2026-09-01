# Frontend request example

For frontend integration. Common call order, request headers, request body, sample code.

Use with main document:

- [RetainPDF Backend API Main Entry](/home/wxyhgk/tmp/Code/doc/core/api/index.md)
- [Rust API README](/home/wxyhgk/tmp/Code/backend/rust_api/README.md)
- [CURRENT_API_MAP](/home/wxyhgk/tmp/Code/backend/rust_api/CURRENT_API_MAP.md)

Document conventions:

- This document is a frontend integration example, not the protocol specification source; the official wording shall be based on `doc/core/api/index.md` as the authoritative source.
- Frontend request examples must uniformly follow the formal request structure after grouping.
- Legacy flat fields removed, no longer accepted.
- Frontend only cares about interface contracts, not dependencies. Rust Internal Module Name

## 1. Required preparations 5 value

When calling the Rust API, the frontend should at least prepare the following values:

1. `X-API-Key`
2. `mineru_token`
3. `base_url`
4. `api_key`
5. `model`

Meaning:

- `X-API-Key`your own Rust Backend Access key
- `mineru_token`ï¼MinerU's API Key
- `base_url`Model Services OpenAI Compatible URL
- `api_key`ï¼model service API Key
- `model`DeepSeek

Optional but recommended fields for frontend sync support:

- `translation.math_mode`: formula translation mode
  - `direct_typst`Default mode: output main text directly. + `$...$` Math
  - `placeholder`: Conservative mode for legacy formula protection chain

## 2. Call Order

Frontend recommended order:

1. Upload PDF
2. Use the upload return value. `upload_id` Create task
3. Poll task status
4. Download on success PDF / Markdown / Bundle

## 3. Upload PDF

Request:

```http
POST /api/v1/uploads
X-API-Key: your-rust-api-key
Content-Type: multipart/form-data
```

Frontend example:

```ts
async function uploadPdf(file: File, backendKey: string, developerMode = false) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("developer_mode", String(developerMode));

  const resp = await fetch("http://127.0.0.1:41000/api/v1/uploads", {
    method: "POST",
    headers: {
      "X-API-Key": backendKey,
    },
    body: formData,
  });

  const data = await resp.json();
  if (!resp.ok || data.code !== 0) {
    throw new Error(data.message || "upload failed");
  }
  return data.data;
}
```

On success, you get:

```json
{
  "upload_id": "20260327-abc123",
  "filename": "paper.pdf",
  "bytes": 1832451,
  "page_count": 18,
  "uploaded_at": "2026-03-27T18:20:31+08:00"
}
```

Upload limits: max 100 MB per file. Max 5 files per request.

- Backend defaults no extra limits. PDF Size and page count
- If the deployer has configured `RUST_API_UPLOAD_MAX_BYTES` / `RUST_API_UPLOAD_MAX_PAGES`Always rely on the actual server error received by the frontend.

## 4. Create task

Requestï¼

```http
POST /api/v1/jobs
X-API-Key: your-rust-api-key
Content-Type: application/json
```

Noteï¼

- Here `workflow: "book"` is the official protocol value for the current complete main link.
- OCR provider selection depends on `ocr.provider`, not `workflow`
- If you just want to run OCR-only, please use POST /api/v1/ocr/jobs (incomplete). Provide full Chinese text. Use /api/v1/jobs with workflow="ocr".
- For local manual one-time debugging, use legacy wrapper run_provider_case.py; Production API main chain consists of Rust job_runner orchestration.
- If the input is already OCR JSON + PDFpreferentially use `run_document_flow.py`
- If you only want to run OCR-only, prefer using run_provider_ocr.py

### 4.1 DeepSeek Example

Recommended request body:

```json
{
  "workflow": "book",
  "source": {
    "upload_id": "20260327-abc123"
  },
  "ocr": {
    "provider": "mineru",
    "mineru_token": "your-mineru-api-key"
  },
  "translation": {
    "base_url": "https://api.deepseek.com/v1",
    "api_key": "your-deepseek-api-key",
    "model": "deepseek-v4-flash",
    "mode": "sci",
    "math_mode": "direct_typst",
    "workers": 50,
    "batch_size": 1,
    "glossary_id": "glossary-20260411-abc123",
    "glossary_entries": [
      {"source": "band gap", "target": "带隙", "note": "materials"}
    ]
  },
  "render": {
    "render_mode": "auto"
  }
}
```

### 4.2 OpenAI Compatibility API example

```json
{
  "workflow": "book",
  "source": {
    "upload_id": "20260327-abc123"
  },
  "ocr": {
    "provider": "mineru",
    "mineru_token": "your-mineru-api-key"
  },
  "translation": {
    "base_url": "http://127.0.0.1:10001/v1",
    "api_key": "your-openai-compatible-api-key",
    "model": "Q3.5-turbo",
    "mode": "precise",
    "math_mode": "direct_typst",
    "workers": 4,
    "batch_size": 1,
    "glossary_id": "",
    "glossary_entries": []
  },
  "render": {
    "render_mode": "auto"
  }
}
```

Frontend example:

```ts
type CreateJobPayload = {
  workflow?: "book" | "translate" | "render";
  source: {
    upload_id: string;
  };
  ocr: {
    provider?: "mineru" | "paddle";
    mineru_token: string;
    page_ranges?: string;
  };
  translation: {
    base_url: string;
    api_key: string;
    model: string;
    mode?: "sci" | "precise";
    math_mode?: "placeholder" | "direct_typst";
    workers?: number;
    batch_size?: number;
    rule_profile_name?: string;
    custom_rules_text?: string;
    glossary_id?: string;
    glossary_entries?: Array<{
      source: string;
      target: string;
      note?: string;
    }>;
  };
  render?: {
    render_mode?: string;
    compile_workers?: number;
  };
};

async function createJob(payload: CreateJobPayload, backendKey: string) {
  const resp = await fetch("http://127.0.0.1:41000/api/v1/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": backendKey,
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json();
  if (!resp.ok || data.code !== 0) {
    throw new Error(data.message || "create job failed");
  }
  return data.data;
}
```

### 4.3 Force validation

`POST /api/v1/jobs` Currently enforces validation:

- `source.upload_id`
- `ocr.mineru_token`
- `translation.base_url`
- `translation.api_key`
- `translation.model`

Additionally:

- base_url Must start with http:// or https://

`translation.math_mode` current convention:

- Default when omitted. `direct_typst`
- If the frontend provides an experimental toggle, the suggested copy is "Direct Formula Output Experimental Mode".
- `direct_typst` Affects only translation-phase formula processing chain; rendering interface call method unchanged.

### 4.4 Pass glossary as JSON map. Key: source term. Value: target term. Load at init.

Recommended:

- When the frontend maintains the "Naming Glossary" list, first call `POST /api/v1/glossaries` Save; pass only in task. `translation.glossary_id`
- For one-off temporary terminology, pass directly. `translation.glossary_entries`
- If the user uploads ExcelFrontend first parses into JSONBackend does not parse directly. Excel
- Incomplete source. Please provide the full Chinese text to translate. CSV Text, call first. `POST /api/v1/glossaries/parse-csv` Convert to standard entry.

Merge rules:

- Naming glossary is the foundation layer.
- Within Task `glossary_entries` It is an overlay.
- Same `source` The entries within the task shall prevail.

Current behavioral boundaries:

- Glossary v1 Only participate in prompt injection and result statistics.
- No action.

## 5. Poll task status

Request:

```http
GET /api/v1/jobs/{job_id}
X-API-Key: your-rust-api-key
```

Frontend example:

```ts
async function getJob(jobId: string, backendKey: string) {
  const resp = await fetch(`http://127.0.0.1:41000/api/v1/jobs/${jobId}`, {
    headers: {
      "X-API-Key": backendKey,
    },
  });

  const data = await resp.json();
  if (!resp.ok || data.code !== 0) {
    throw new Error(data.message || "get job failed");
  }
  return data.data;
}

async function pollJobUntilDone(jobId: string, backendKey: string) {
  while (true) {
    const job = await getJob(jobId, backendKey);
    const status = job.status;

    if (status === "succeeded" || status === "failed" || status === "canceled") {
      return job;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
```

Recent task list API also returns protocol aggregation:

- `items[].invocation`
- `invocation_summary.stage_spec_count`
- `invocation_summary.unknown_count`

Note:

- Don't use `progress.percent >= 90` Judgment complete
- Required `status` Check if complete
- `queued` Task created; may be pending execution slot.
- In the task details `invocation` directly usable for current task display. stage spec protocol
  - `invocation.input_protocol`
  - `invocation.stage_spec_schema_version`

## 6. Download result

Common APIs:

- PDF：`GET /api/v1/jobs/{job_id}/pdf`
- Markdown(JSON)：`GET /api/v1/jobs/{job_id}/markdown`
- Markdown(raw)：`GET /api/v1/jobs/{job_id}/markdown?raw=true`
- Bundle(zip)：`GET /api/v1/jobs/{job_id}/download`

Prefer frontend to fetch task or artifact details first, then use the server-returned. `actions`：

- `actions.download_pdf.url`
- `actions.open_markdown.url`
- `actions.open_markdown_raw.url`
- `actions.download_bundle.url`

## 7. Complete frontend example

```ts
async function runPdfTranslateFlow(file: File, config: {
  backendKey: string;
  mineruToken: string;
  modelBaseUrl: string;
  modelApiKey: string;
  model: string;
  mode?: "sci" | "precise";
  mathMode?: "placeholder" | "direct_typst";
}) {
  const upload = await uploadPdf(file, config.backendKey, false);

  const job = await createJob({
    workflow: "book",
    source: {
      upload_id: upload.upload_id,
    },
    ocr: {
      provider: "mineru",
      mineru_token: config.mineruToken,
    },
    translation: {
      base_url: config.modelBaseUrl,
      api_key: config.modelApiKey,
      model: config.model,
      mode: config.mode ?? "sci",
      math_mode: config.mathMode ?? "direct_typst",
      workers: 50,
      batch_size: 1,
    },
    render: {
      render_mode: "auto",
    },
  }, config.backendKey);

  const finalJob = await pollJobUntilDone(job.job_id, config.backendKey);

  if (finalJob.status !== "succeeded") {
    throw new Error(finalJob.stage_detail || "job failed");
  }

  return {
    jobId: finalJob.job_id,
    pdfUrl: finalJob.actions.download_pdf.url,
    markdownUrl: finalJob.actions.open_markdown.url,
    bundleUrl: finalJob.actions.download_bundle.url,
  };
}
```

## 8. Use camelCase. Match DOM/API conventions. Be descriptive, not verbose. Avoid abbreviations unless universal (e.g., `id`, `url`). Prefix booleans with `is/has/can`. Group related state in objects. No Hungarian notation.

Suggest frontend internals distinguish variables clearly; do not mix:

- `backendKey`: Rust API's `X-API-Key`
- `mineruToken`: MinerU key
- `modelBaseUrl`Model Service URL
- `modelApiKey`: model service key
- `model`DeepSeek
- `mathMode`Formula translation mode, default `direct_typst`

## 9. `math_mode` When to enable

Default recommended `direct_typst`If the frontend needs to expose a toggle, put it in advanced options, but do not put... `placeholder` Set as default.

- Normal task: omit or pass explicitly. `direct_typst`
- Only pass when rolling back old formula protection chain. `placeholder`
- If the frontend later needs a switch, recommend passing a string directly; do not infer on the frontend whether the document has "many formulas".

This prevents confusion when integrating multiple service providers later.
