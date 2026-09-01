

**Pain points**

Foreign papers, textbooks, and technical documents have high information density but are difficult to read:

- Reading the original text is difficult and inefficient.
- Plain-text only. Formulas, images, layout break.
- Hard to organize, share, archive.

**RetainPDF Actions**

Upload PDF for one-click Chinese translation preserving original layout.

- output translation PDF、Markdown、ZIP Package, use as needed.
- Direct operation via web interface; also supports command line and API access
- Image PDFHandles scanned copies and screenshots, not just editable files. PDF

**Translation preview**

Typical SCI paper translation effect:

https://./g-1.png

Image PDF translation comparison results:

https://./g-2.png

**Compared to similar solutions, what are the advantages?**

- Compare [PDFMathTranslate](https://github.com/PDFMathTranslate/PDFMathTranslate)fills the gap for image-based PDF Weakness: inline formulas blend naturally with text, significantly reducing layout breakage risk.
- Compare Doc2X Wait for closed-source solution: self-deployable, full control over API and result files; empirically superior overall quality.
- Tested output near production-ready; no manual reformatting needed.




# Novice user

If you just want to get the service running, follow the steps below.

## 1. Verify machine environment.

Recommended environment:

- System:`Linux` Priority, Recommended. `Ubuntu 22.04 / 24.04`
- CPU Architecture: current image built for x86_64 / amd64, not ARM version
- CPUAt least `4 core`
- Memory: at least `8GB`, recommended `16GB` or higher
- Disk: at least `10GB` Available space
- Network: access required. Docker Hub、MinerU and your model API

Note:

- This project mainly eats. CPUMemory network no discrete GPU
- If your machine is `Mac M`Raspberry PiARM Server, confirm availability first. `x86_64` Runtime Environment Compatibility
- For lightweight personal use, 4 cores + 8GB can start the service.
- If multiple users need simultaneous access, start from 8 cores + 16GB

## 2. Install Docker

First confirm already installed on system:

- `docker`
- `docker compose`

Install complete. Self-check first:

```bash
docker --version
docker compose version
```

## 3. Pull GitHub Project

```bash
git clone https://github.com/wxyhgk/retain-pdf.git
cd retain-pdf/docker/delivery
```

## 4. Start service

```bash
docker compose up -d
```

After startup, default access address:

```text
http://127.0.0.1:40001
```

# Power user

## File purpose

- `docker-compose.yml`
  Docker Orchestration entry. Default: direct pull. Docker Hub Mirror and start `app` + `web`。
- `docker/app.env`
  Backend runtime parameters. Controls container paths, fonts, ports, concurrency, and upload limits.
- `docker/web.env`
  Docker Public frontend runtime parameters. Control the default backend injected by the frontend. keyModel defaults etc.
- `docker/auth.local.json`
  Rust API Authentication whitelist. Frontend and CLI All need to use the backend configured here. key Only then can the interface be accessed.

## Common changes

### docker/auth.local.json

- `api_keys`
  Rust API Allowed backends key List. In frontend request headers. `X-API-Key` Must match one of the values here.
- `max_running_jobs`
  Backend max concurrent tasks.
- `simple_port`
  multipart Flat-field submission interface container listen port. Default: `42000`Externally expose nothing directly.

### docker/web.env

- `FRONT_API_BASE`
  Internal frontend use only. API Base URL. Leave empty; frontend uses same-origin proxy.
- `FRONT_X_API_KEY`
  Frontend auto-attaches to backend. `X-API-Key`Must and required. `docker/auth.local.json` Value must match.
- `FRONT_OCR_PROVIDER`
  Frontend default OCR providerCurrent suggestion fill `paddle`can also be cut `mineru`。
- `FRONT_PADDLE_TOKEN`
  Frontend default Paddle tokenLeave blank. User fills in popup.
- `FRONT_MINERU_TOKEN`
Frontend default MinerU token. Leave empty for end user to fill in popup.
- `FRONT_MODEL_API_KEY`
  Default frontend model API keyLeave blank for end user to fill.
- `FRONT_MODEL`
  Frontend default model name, e.g. `deepseek-v4-flash`。
- `FRONT_BASE_URL`
  Frontend default model service address, e.g. `https://api.deepseek.com/v1`。

### docker/app.env

- `PROJECT_ROOT`
  Project root directory inside container.
- `RUST_API_ROOT`
Inside container Rust API directory.
- `RUST_API_DATA_ROOT`
  Rust API Runtime data root directory. Stores uploaded files, task directories, download cache, and database.`RUST_API_DATA_DIR` Legacy alias compatibility only.
- `OUTPUT_ROOT`
  Task output directory.
- `PYTHON_BIN`
  Backend call Python Interpreter used by the script.
- `TYPST_BIN`
  Typst Executable path.
- `RETAIN_PDF_FONT_PATH`
  Default Chinese font file path.
- `RETAIN_PDF_TYPST_FONT_FAMILY`
  Typst Default font family name.
- `RUST_API_PORT`
Full API default listening port inside container 41000.
- `RUST_API_SIMPLE_PORT`
multipart flat field submit interface port inside container, default 42000.
- `RUST_API_MAX_RUNNING_JOBS`
  Maximum concurrent running tasks.
- `RUST_API_UPLOAD_MAX_BYTES`
  Backend default upload size limit,`0` Indicates no limit; current delivery package suggests writing as. `209715200`。
- `RUST_API_UPLOAD_MAX_PAGES`
Backend normal upload page count limit; 0 means no limit; current delivery package suggests writing as 300.

## Notes

- Current compose exposes by default:
- 40001: frontend page
- 41000: full Rust API
- 42000: multipart flat field submit API, only provides /health and POST /api/v1/translate/bundle
- Frontend accesses backend via same-origin proxy; regular users typically need not understand. `API Base`
- Current mainline frontend default OCR provider is paddle
- Display size / Page limit from current backend runtime config; do not use old value. MinerU Understanding Fixed Upstream Limits

## Optional default value

If you want the frontend to default to downstream config, continue filling:

- `FRONT_OCR_PROVIDER`
- `FRONT_PADDLE_TOKEN`
- `FRONT_MINERU_TOKEN`
- `FRONT_MODEL_API_KEY`
- `FRONT_MODEL`
- `FRONT_BASE_URL`

If left blank, end users need to at the upper-right corner of the page's “API Configure manually in the popup.

## Switch to your own image version.

Alternatively, start like this:

```bash
APP_IMAGE=wxyhgk/retainpdf-app:<version> \
WEB_IMAGE=wxyhgk/retainpdf-web:<version> \
docker compose up -d
```

# Developer

If you want to use it directly CLI Call the API instead of going through the frontend page. Invoke as follows.

Define variables.

```bash
export HOST="http://127.0.0.1:40001"
export X_API_KEY="replace-with-your-backend-key"
export OCR_PROVIDER="paddle"
export PADDLE_TOKEN="your-paddle-token"
export MINERU_TOKEN="your-mineru-token"
export MODEL_API_KEY="your-model-api-key"
export MODEL="deepseek-v4-flash"
export BASE_URL="https://api.deepseek.com/v1"
```

## Health check

```bash
curl "$HOST/health"
```

## Upload PDF

```bash
curl -X POST "$HOST/api/v1/uploads" \
  -H "X-API-Key: $X_API_KEY" \
  -F "file=@/absolute/path/to/your.pdf"
```

Return will contain:

- `upload_id`
- `filename`
- `page_count`

## Create async task

First, enter the `upload_id` returned from the previous step: `upload_id` Fill in:

```bash
curl -X POST "$HOST/api/v1/jobs" \
  -H "X-API-Key: $X_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow": "book",
    "source": {
      "upload_id": "your-upload-id"
    },
    "ocr": {
      "provider": "'"$OCR_PROVIDER"'",
      "paddle_token": "'"$PADDLE_TOKEN"'",
      "mineru_token": "'"$MINERU_TOKEN"'"
    },
    "translation": {
      "api_key": "'"$MODEL_API_KEY"'",
      "model": "'"$MODEL"'",
      "base_url": "'"$BASE_URL"'",
      "mode": "sci"
    },
    "render": {
      "render_mode": "auto"
    },
    "runtime": {
      "workers": 100,
      "batch_size": 1,
      "classify_batch_size": 12,
      "compile_workers": 8,
      "timeout_seconds": 1800
    }
  }'
```

The return will contain:

- `job_id`
- `status`

## Query task status

```bash
curl -H "X-API-Key: $X_API_KEY" \
  "$HOST/api/v1/jobs/your-job-id"
```

Focus on these fields:

- `status`
- `stage`
- `stage_detail`
- `progress`
- `actions`

The final state of a task is typically:

- `succeeded`
- `failed`
- `canceled`

## Download results

Download PDF:

```bash
curl -L -H "X-API-Key: $X_API_KEY" \
  "$HOST/api/v1/jobs/your-job-id/pdf" \
  -o translated.pdf
```

Download Markdown:

```bash
curl -L -H "X-API-Key: $X_API_KEY" \
  "$HOST/api/v1/jobs/your-job-id/markdown?raw=true" \
  -o translated.md
```

Download ZIP:

```bash
curl -L -H "X-API-Key: $X_API_KEY" \
  "$HOST/api/v1/jobs/your-job-id/download" \
  -o result.zip
```

## Cancel task

```bash
curl -X POST -H "X-API-Key: $X_API_KEY" \
  "$HOST/api/v1/jobs/your-job-id/cancel"
```

## multipart Flatten commit interface

If you don't want to call it yourself first. `/api/v1/uploads`Upload directly. PDF Create asynchronous tasks.

Note:

- This API is forwarded by a frontend same-origin proxy.
- Default path is `/api/v1/translate/bundle`
- Request returns `ApiResponse<JobSubmissionView>`, which contains `job_id` and initial `status`
- Interface does not wait for OCR / translation / rendering to complete, does not directly return ZIP.
- Polling still required. `GET /api/v1/jobs/{job_id}`Complete, then download. `/api/v1/jobs/{job_id}/download`

```bash
curl -X POST "$HOST/api/v1/translate/bundle" \
  -H "X-API-Key: $X_API_KEY" \
  -F "file=@/absolute/path/to/your.pdf" \
  -F "provider=$OCR_PROVIDER" \
  -F "paddle_token=$PADDLE_TOKEN" \
  -F "mineru_token=$MINERU_TOKEN" \
  -F "base_url=$BASE_URL" \
  -F "api_key=$MODEL_API_KEY" \
  -F "model=$MODEL" \
  -F "mode=sci" \
  -F "workers=100" \
  -F "batch_size=1"
```

Note:

- provider Recommend explicitly passing paddle or mineru.
- `paddle_token` / `mineru_token` Only pass current. `provider` The corresponding one.
