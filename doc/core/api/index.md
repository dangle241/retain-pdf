# RetainPDF backend API main entry

This document is the sole entry point for frontend integration, third-party calls, and backend joint debugging. Other. API Document only as feature page or legacy compatibility entry.

## 1. Basic conventions

- Full API default port: 41000
- multipart async submit API default port: 42000
- Health check: GET /health
- Business prefix:`/api/v1`
- Except GET /health, business APIs require X-API-Key by default.

Success response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

Error Response:

```json
{
  "code": 40000,
  "message": "invalid request"
}
```

Common error codes:

- `40000`Request error.
- `40100`Authentication failed
- `40400`Resource not found.
- `40900`Status conflict
- `42900`Model or external service rate limiting.
- `50200`Model or external service failure.
- `50000`Internal error.

`X-API-Key` Access Rust API Backend whitelist key, not OCR Provider token, nor the model API key。

## 2. Recommended frontend integration path

Library page preferentially use the "book semantics" interface:

- `GET /api/v1/library/books`
- `GET /api/v1/library/books/{job_id}`
- `DELETE /api/v1/library/books/{job_id}`
- `POST /api/v1/library/books/delete`
- `GET /api/v1/library/books/{job_id}/cover`
- `GET /api/v1/library/books/{job_id}/thumbnail`

Task creation and execution still proceed. job API：

1. `POST /api/v1/uploads`
2. `POST /api/v1/jobs`
3. `GET /api/v1/jobs/{job_id}`
4. `GET /api/v1/jobs/{job_id}/events`
5. Download artifacts based on actions / artifacts / artifacts_display
6. Read Q&A for completed tasks `POST /api/v1/jobs/{job_id}/reader/ai/chat`

## 3. Library API

List:

`GET /api/v1/library/books?limit=20&offset=0&q=physics`

Query parameters:

- `limit` / `offset`Pagination.
- q: optional, search entire library by book title, source file name, job_id, source URL, and status text.

Returns data.items[]:

```json
{
  "id": "job-id",
  "job_id": "job-id",
  "title": "book title",
  "display_name": "book title",
  "source_file_name": "source.pdf",
  "authors": null,
  "page_count": 533,
  "status": "succeeded",
  "stage": "finished",
  "stage_detail": "done",
  "progress": {
    "current": 533,
    "total": 533,
    "percent": 100.0
  },
  "cover_url": "/api/v1/library/books/job-id/cover",
  "thumbnail_url": "/api/v1/library/books/job-id/thumbnail",
  "output_pdf_ready": true,
  "markdown_ready": true,
  "bundle_ready": true,
  "created_at": "2026-05-16T00:00:00Z",
  "updated_at": "2026-05-16T00:10:00Z"
}
```

Details:

`GET /api/v1/library/books/{job_id}`

Return key fields:

- `id`
- `job_id`
- `title`
- `authors`
- `source_file_name`
- `page_count`
- `source_language`
- `target_language`
- `file_size_bytes`
- `status`
- `stage`
- `progress`
- `cover_url`
- `thumbnail_url`
- `artifacts`

Delete:

- `DELETE /api/v1/library/books/{job_id}`
- `DELETE /api/v1/library/books/{job_id}?force=true`
- `POST /api/v1/library/books/delete`

Deletion behavior:

- Delete main job record
- Delete association `artifacts` / `job_artifact_entries` / `events`
- Delete `DATA_ROOT/jobs/{job_id}`
- Delete DATA_ROOT/downloads/{job_id}.zip
- If exists. `{job_id}-ocr` Delete subtasks as well.
- Default: do not delete. `uploads` Please provide the source text for translation.
- `queued` / `running` Reject deletion by default unless passed. `force=true`

## 4. Upload endpoint

`POST /api/v1/uploads`

`multipart/form-data`：

- `file`Required,PDF
- `developer_mode`Optional,`true/false`

Return key fields:

- `upload_id`
- `filename`
- `bytes`
- `page_count`
- `uploaded_at`

## 5. Create task

`POST /api/v1/jobs`

Accept only grouped JSON, does not accept old flat JSON。

Top-level structure:

```json
{
  "workflow": "book",
  "source": {
    "upload_id": "upload-id"
  },
  "ocr": {
    "provider": "paddle",
    "paddle_token": "paddle-access-token",
    "language": "ch",
    "page_ranges": ""
  },
  "translation": {
    "mode": "sci",
    "math_mode": "direct_typst",
    "model": "deepseek-v4-flash",
    "base_url": "https://api.deepseek.com/v1",
    "api_key": "sk-xxxx",
    "batch_size": 1,
    "workers": 50
  },
  "render": {
    "render_mode": "auto",
    "compile_workers": 8
  },
  "runtime": {
    "timeout_seconds": 1800
  }
}
```

`workflow`：

- `book`：OCR -> Normalize -> Translate -> Render
- `translate`：OCR -> Normalize -> Translate
- `render`: based on existing job artifact Rerun render.

Stage recovery:

- `POST /api/v1/jobs/{job_id}/rerun`
- `GET /api/v1/jobs/{job_id}/stage-actions`
- `POST /api/v1/jobs/{job_id}/retry-stage`
- `GET /api/v1/jobs/{job_id}/resume-plan`
- `POST /api/v1/jobs/{job_id}/resume`
- With translations_dir + source_pdf, reuse original job_id to in-place re-render and replace rendered output.
- Only with normalized_document_json + source_pdf, create a new book resume job.
- `workflow=translate` + `source.artifact_job_id`Reuse OCR checkpoint
- workflow=book + source.artifact_job_id: reuse OCR checkpoint then continue translation and rendering
- `workflow=render` + `source.artifact_job_id`After reusing translation artifacts, only re-run rendering.

`/resume` Reuse Current `/rerun` Resume execution contract;`/resume-plan` For frontend display: where restore from, which artifacts reused, which stages rerun.

Active phase retry:

`GET /api/v1/jobs/{job_id}/stage-actions`

Return whether each stage can currently be actively rerun. Frontend buttons read this interface first; do not guess retryable stages.

```json
{
  "job_id": "job-id",
  "stages": [
    {
      "stage": "translation",
"label": "Retry translation",
      "can_retry": true,
      "disabled_reason": "",
      "will_reuse": ["source_pdf", "ocr_result"],
      "will_rerun": ["translation", "render"],
      "danger": false,
      "action": {
        "method": "POST",
        "url": "/api/v1/jobs/job-id/retry-stage",
        "body": {
          "stage": "translation",
          "mode": "from_stage",
          "create_new_job": true
        }
      }
    }
  ]
}
```

`POST /api/v1/jobs/{job_id}/retry-stage`

```json
{
  "stage": "render",
  "mode": "from_stage",
  "create_new_job": true,
  "overrides": {
    "render": {
      "compile_workers": 8
    }
  }
}
```

Return new or in-place task. `job_id`Frontend use response as-is. `job_id`
Enter polling with GET /jobs/{job_id} and GET /jobs/{job_id}/events.

## 6. Task queries and events

Task Query:

- `GET /api/v1/jobs?limit=20&offset=0&status=&workflow=&provider=`
- `GET /api/v1/jobs/{job_id}`

Key fields:

- `job_id`
- `workflow`
- `status`
- `stage`
- `stage_detail`
- `progress`
- `timestamps`
- `request_payload`
- `actions`
- `artifacts`
- `artifacts_display`
- `book_summary`
- `contracts`
- `ocr_job`
- `runtime`
- `failure`
- `failure_diagnostic`
- `normalization_summary`
- `glossary_summary`
- `invocation`
- `log_tail`

Event:

`GET /api/v1/jobs/{job_id}/events?limit=200&offset=0`

Stable fields for frontend consumption:

- `stage`
- `substage`
- `lane`
- `stage_detail`
- `event_type`
- `raw_event_type`
- `progress`
- `message`
- `payload`

Among them:

- `stage`Public display stage, currently only according to `ocr` / `translation` / `render` / `done` understand.
- `substage`Machine-readable sub-stage.
- `lane`Event channel; main status card consumes only. `main`。
- `progress`Only recommended progress object.
- `message`Human-readable only. Frontend must not use it for stage detection.

`stage` Enumeration:

- `ocr`
- `translation`
- `render`
- `done`

`substage` Machine-readable substage, e.g.

- `ocr_processing`
- `translation_batches`
- `translation_tail_retry`
- `continuation_review`
- `page_policies`
- `domain_inference`
- `garbled_repair`
- `agent_repair`
- `final_untranslated_recovery`
- `render_prepare`
- `render_prewarm`
- `render_pages`
- `render_compile`

`lane` Available:

- `main`Main status card displayable.
- `background`Background warm-up or cache building must not overwrite main state.
- `artifact`Artifact Release.
- `diagnostic`Diagnostic information.

event_type can be:

- `progress`
- `artifact`
- `terminal`
- `error`
- `diagnostic`

`progress` Object:

```json
{
  "unit": "page",
  "current": 37,
  "total": 142,
  "percent": 26.056338028169012
}
```

progress_unit can be:

- `page`
- `batch`
- `step`
- `percent`
- `none`

Compatibility notes:

- API In the output `progress_current` / `progress_total` / `progress_unit` Internal compatibility field. Not serialized by default. Frontend reads first. `progress`。
- `message` Human-readable only. Frontend must not use for stage detection.
- Python In the original event `user_stage` Not public API Field exposed; view during troubleshooting. `payload.raw_user_stage`。

The main task event stream will merge OCR Subtask progress. Retains history after task completion.

Frontend integration minimal rules:

1. Only status card stage recognized. `stage`。
2. Sub-stage cards only `substage`。
3. Progress bar accepts only `progress.unit/current/total/percent`。
4. If background warm-up, cache, and parallel rendering preparation class events `lane != "main"`cannot override the main status card.
5. Event ordering: read first. `seq`, there is no `seq` Reuse `created_at`。

Failure diagnosis:

`GET /api/v1/jobs/{job_id}/diagnostics`

Return stable fields:

```json
{
  "failed_stage": "translation",
  "failed_substage": "continuation_review",
"summary": "Translation phase timeout",
  "detail": "provider timed out",
"suggestion": "Resume task from checkpoint",
  "retryable": true,
  "resume_available": true,
  "render_diagnostics": {
    "typst_cover_fallback_pages": {
      "count": 2,
      "head": [2, 5],
      "tail": []
    },
    "typst_cover_fallback_items": {
      "count": 3,
      "head": ["p002-b002", "p005-b004", "p005-b007"],
      "tail": []
    }
  }
}
```

`render_diagnostics` Optional field, only in `artifacts/pipeline_summary.json`
Returned when render diagnostics included. Used to troubleshoot which pages or after physical deletion failure. block
went through Typst White background fallback; does not indicate task failure.

Breakpoint Recovery Plan

`GET /api/v1/jobs/{job_id}/resume-plan`

```json
{
  "can_resume": true,
  "job_id": "job-id",
  "from_stage": "render",
  "resume_workflow": "render",
  "reuses_artifacts": ["source_pdf", "translations_dir", "normalized_document_json"],
  "reruns_stages": ["rendering"],
  "reason": null
}
```

Execute recovery:

`POST /api/v1/jobs/{job_id}/resume`

Same response. `POST /api/v1/jobs/{job_id}/rerun`, return `JobSubmissionView`。

## 7. Artifacts and Downloads

Artifact Interface:

- `GET /api/v1/jobs/{job_id}/artifacts`
- `GET /api/v1/jobs/{job_id}/artifacts-manifest`
- `GET /api/v1/jobs/{job_id}/artifacts/{artifact_key}`
- `GET /api/v1/jobs/{job_id}/pdf`
- `GET /api/v1/jobs/{job_id}/markdown`
- `GET /api/v1/jobs/{job_id}/markdown/document`
- `GET /api/v1/jobs/{job_id}/markdown?raw=true`
- `GET /api/v1/jobs/{job_id}/markdown/images/*path`
- `GET /api/v1/jobs/{job_id}/download`
- `GET /api/v1/jobs/{job_id}/normalized-document`
- `GET /api/v1/jobs/{job_id}/normalization-report`

Frontend button state: read first.

- `actions.*.enabled`
- `artifacts.*.ready`
- `artifacts_display[].ready`
- `artifacts-manifest.items[].ready`

Markdown notes:

- `/markdown` default returns JSON Package
- `/markdown/document` Return structured document view, including `content`、`content_with_absolute_image_urls`、`images[]` Image direct link list, suitable for frontend preview and AI Q&A
- /markdown?raw=true returns raw Markdown
- Images are read via /markdown/images/*path

PDF On-demand loading:

- `GET /api/v1/jobs/{job_id}/pdf`
- `GET /api/v1/jobs/{job_id}/artifacts/source_pdf`

Both interfaces support HTTP Range requests; frontend PDF.js prefers URL pattern, not fetching entire PDF to ArrayBuffer first.

Backend prioritizes returning linearized. PDF Cache:

- If runtime environment exists `qpdf`lazy-generated on first download `*.linearized.pdf`
- Subsequent downloads reuse cache.
- If qpdf is not available, automatically fall back to original PDF; does not affect API availability.

Request example:

```http
GET /api/v1/jobs/{job_id}/pdf
X-API-Key: your-rust-api-key
Range: bytes=0-65535
```

Success response:

```http
206 Partial Content
Accept-Ranges: bytes
Content-Range: bytes 0-65535/12345678
Content-Length: 65536
Content-Type: application/pdf
```

Cross-origin reads: backend exposes:

- `Accept-Ranges`
- `Content-Range`
- `Content-Length`
- `X-Job-Id`

Page-level preview:

`GET /api/v1/jobs/{job_id}/preview/pages/{page}?kind=translated`

Parameters:

- `page`：1-based Page
- kind: source | translated, default translated
- `width`Optional, default `1200`, range `240..2400`
- `dpi`Optional, higher priority than `width`Max `300`

Response:

```http
200 OK
Content-Type: image/jpeg
Cache-Control: public, max-age=31536000, immutable
ETag: "..."
```

Preview Image job Cache `DATA_ROOT/jobs/{job_id}/artifacts/` Frontend request page 1 preview first for instant load. Background load rest. PDF.js。

## 8. Contrastive reading assist API

Reading area mapping:

`GET /api/v1/jobs/{job_id}/reader/regions`

Each item includes:

- `item_id`
- `source.page/bbox/unit/origin/text`
- `translated.page/bbox/unit/origin/text`
- `markdown`
- `region_type`
- `status`

Coordinate units fixed to. PDF point, with the origin at the top-left corner. The frontend can use `item_id` Please provide the source text to translate. hover to the original bbox mapping, or you can directly use `text` / `markdown` Copy menu.

PDF Metadata:

`GET /api/v1/jobs/{job_id}/reader/metadata`

Returns source/translated odd pages left, even pages right.

```json
{
  "source": {
    "page_count": 533,
    "pages": [{ "page": 1, "width": 595, "height": 842 }]
  },
  "translated": {
    "page_count": 533,
    "pages": [{ "page": 1, "width": 595, "height": 842 }]
  }
}
```

one side PDF When not ready, this side returns. `null`。

## 9. OCR-only endpoints

- `POST /api/v1/ocr/jobs`
- `GET /api/v1/ocr/jobs?limit=20&offset=0&status=&provider=`
- `GET /api/v1/ocr/jobs/{job_id}`
- `GET /api/v1/ocr/jobs/{job_id}/events`
- `GET /api/v1/ocr/jobs/{job_id}/artifacts`
- `GET /api/v1/ocr/jobs/{job_id}/artifacts-manifest`
- `GET /api/v1/ocr/jobs/{job_id}/artifacts/{artifact_key}`
- `GET /api/v1/ocr/jobs/{job_id}/normalized-document`
- `GET /api/v1/ocr/jobs/{job_id}/normalization-report`
- `POST /api/v1/ocr/jobs/{job_id}/cancel`

## 10. Glossary endpoints

- `POST /api/v1/glossaries/parse-csv`
- `POST /api/v1/glossaries`
- `GET /api/v1/glossaries`
- `GET /api/v1/glossaries/{glossary_id}`
- `PUT /api/v1/glossaries/{glossary_id}`
- `DELETE /api/v1/glossaries/{glossary_id}`

Glossary for frontend custom vocabulary list:

- Do not translate, preserve original:`level=preserve`
- API → API CPU → CPU DB → DB HTTP → HTTP ID → ID JSON → JSON OS → OS URL → URL UUID → UUID XML → XML HTTPS → HTTPS SQL → SQL CLI → CLI GUI → GUI SDK → SDK UI → UI UX → UX RAM → RAM ROM → ROM GPU → GPU SSD → SSD HDD → HDD IoT → IoT AI → AI ML → ML DL → DL NLP → NLP DBMS → DBMS RDBMS → RDBMS NoSQL → NoSQL ORM → ORM REST → REST GraphQL → GraphQL gRPC → gRPC WebSocket → WebSocket TCP/IP → TCP/IP DNS → DNS DHCP → DHCP VPN → VPN SSH → SSH SSL/TLS → SSL/TLS JWT → JWT OAuth → OAuth SAML → SAML LDAP → LDAP SMTP → SMTP IMAP → IMAP POP3 → POP3 FTP → FTP SFTP → SFTP SCP → SCP CI/CD → CI/CD DevOps → DevOps SRE → SRE IaC → IaC Terraform → Terraform Ansible → Ansible Kubernetes → Kubernetes Docker → Docker container → container microservice → microservice monolith → monolith serverless → serverless edge computing → edge computing blockchain → blockchain cryptocurrency → cryptocurrency bitcoin → bitcoin ethereum → ethereum smart contract → smart contract NFT → NFT DeFi → DeFi DAO → DA frontend → frontend backend → backend full-stack → full-stack middleware → middleware cache → cache load balancer → load balancer CDN → CDN DNS → DNS firewall → firewall proxy → proxy gateway → gateway router → router switch → switch hub → hub bridge → bridge tunnel → tunnel VPN → VPN NAT → NAT subnet → subnet VLAN → VLAN IP → IP MAC → MAC port → port socket → socket endpoint → endpoint request → request response → response header → header payload → payload query → query parameter → parameter cookie → cookie session → session token → token authentication → authentication authorization → authorization permission → permission role → role user → user account → account profile → profile password → password username → username email → email login → login logout → logout register → register signup → signup signin → signin verify → verify confirm → confirm reset → reset recover → recover 2FA → 2FA MFA → MFA CAPTCHA → CAPTCHA rate limit → rate limit throttle → throttle DDoS → DDoS DoS → DoS spoofing → spoofing injection → injection XSS → XSS CSRF → CSRF SQLi → SQLi RCE → RCE MITM → MITM phishing → phishing malware → malware virus → virus worm → worm trojan → trojan ransomware → ransomware spyware → spyware adware → adware rootkit → rootkit backdoor → backdoor exploit → exploit patch → patch update → update upgrade → upgrade rollback → rollback backup → backup restore → restore snapshot → snapshot log → log audit → audit compliance → compliance GDPR → GDPR HIPAA → HIPAA PCI DSS → PCI DSS SOC 2 → SOC 2 ISO 27001 → ISO 27001 encryption → encryption decryption → decryption hash → hash salt → salt key → key certificate → certificate private key → private key public key → public key CSR → CSR PKI → PKI TLS → TLS HTTPS → HTTPS SSL → SSL cipher → cipher algorithm → algorithm AES → AES RSA → RSA ECC → ECC SHA → SHA MD5 → MD5 HMAC → HMAC IV → IV nonce → nonce salt → salt tokenization → tokenization anonymization → anonymization pseudonymization → pseudonymization GDPR → GDPR PII → PII PID → PID PHI → PHI PCI → PCI PAN → PAN CVV → CVV expiry → expiry tokenization → tokenization PCI DSS → PCI DSS PCI → PCI PCIe → PCIe USB → USB HDMI → HDMI Thunderbolt → Thunderbolt Bluetooth → Bluetooth Wi-Fi → Wi-Fi Ethernet → Ethernet LAN → LAN WAN → WAN MAN → MAN PAN → PAN SAN → SAN NAS → NAS RAID → RAID JBOD → JBOD SSD → SSD HDD → HDD NVMe → NVMe SATA → SATA PCIe → PCIe GPU → GPU APU → APU TPU → TPU FPGA → FPGA ASIC → ASIC SoC → SoC CPU → CPU ALU → ALU CU → CU cache → cache register → register pipeline → pipeline clock speed → clock speed GHz → GHz MHz → MHz byte → byte bit → bit KB → KB MB → MB GB → GB TB → TB PB → PB EB → EB ZB → ZB YB → YB bps → bps Kbps → Kbps Mbps → Mbps Gbps → Gbps Tbps → Tbps latency → latency throughput → throughput bandwidth → bandwidth jitter → jitter packet → packet frame → frame MTU → MTU TTL → TTL QoS → QoS SLA → SLA SLO → SLO SLI → SLI RTO → RTO RPO → RPO`level=canonical`
- Soft preference translation`level=preferred`

Table row fields:

```json
{
  "source": "Hartree-Fock",
  "target": "Hartree-Fock",
  "level": "preserve",
  "match_mode": "case_insensitive",
  "context": "",
  "note": "method name, keep English"
}
```

Field description:

- `source`Original entry, required.
- `target`: target translation.`level=preserve` Time optional; backend auto-sets. `source`。
- `level`：
  - `preserve`: forcibly preserve, do not translate.
  - `canonical`Mandatory fixed translation.
  - `preferred`Prioritize this translation; not enforced.
- `match_mode`：
  - `exact`Default: exact match.
  - `case_insensitive`Ignore case.
  - `regex`Regular expression matching.
- `context`Optional. Activates only if context includes term.
- `note`Please provide the source text to translate. prompt For explanation.

Create glossary:

```http
POST /api/v1/glossaries
```

```json
{
  "name": "Quantum Chemistry Terminology",
  "entries": [
    {
      "source": "Hartree-Fock",
      "target": "",
      "level": "preserve",
      "match_mode": "case_insensitive",
      "note": "Preserve English"
    },
    {
      "source": "density functional theory",
"target": "Density functional theory",
      "level": "canonical",
      "match_mode": "case_insensitive",
      "note": "Fixed professional translation."
    }
  ]
}
```

Update glossary:

```http
PUT /api/v1/glossaries/{glossary_id}
```

Request body identical to creation endpoint. Backend processes as whole. `entries` Array replacement.

CSV Parse:

```http
POST /api/v1/glossaries/parse-csv
```

```json
{
"csv_text": "Original term,Translation,Type,Match mode,Note\nHartree-Fock,,Keep,Case insensitive,Keep English\nDFT,Density Functional Theory,Professional translation,Case insensitive,Fixed Translation\n"
}
```

CSV Headers support English and Chinese aliases:

- Source term:`source/src/term/original/source term/original text/term`
- Translation:`target/translation/translated/translation/translated text/target translation`
- Type:`level/mode/action/type/mode/action`
- Match mode:match/match_mode/match/match_mode
- Remarks:`note/comment/remarks/description`
- Context:`context/ä¸ä¸æ/è¯­å¢`

When submitting a task, it can reference a named glossary via translation.glossary_id, or pass inline entries via translation.glossary_entries.

## 11. Provider Validate

- `POST /api/v1/providers/mineru/validate-token`
- `POST /api/v1/providers/paddle/validate-token`
- `POST /api/v1/providers/deepseek/validate-token`
- `POST /api/v1/providers/deepseek/balance`

Recommended return status:

- `valid`
- `unauthorized`
- `expired`
- `network_error`
- `provider_error`

## 12. Simple app entry

`POST /api/v1/translate/bundle`

This API belongs to simple appusually listens `42000`It accepts multipart Flat fields, direct script upload. PDF Create background translation task.

This API returns ApiResponse<JobSubmissionView>, does not wait for Python OCR/translation/rendering to complete synchronously and return ZIP.

## 13. Storage and Ownership

Backend is books,PDFArtifacts and cover are single source of truth. Frontend does not persist real files.

Primary storage

- `DATA_ROOT/uploads/`Upload file
- `DATA_ROOT/jobs/{job_id}/`Task working directory
- `DATA_ROOT/downloads/`Download Cache
- `DATA_ROOT/db/jobs.db`：SQLite Database

SQLite Main table.

- uploads: source file name, source PDF size, page count
- jobs: task status, stage, progress, timestamps, request/runtime state
- `artifacts`Task artifact path and cached book display metadata.
- `job_artifact_entries`Normalized artifacts manifest
- `events`Complete History Progress Flow

## 14. Topic documentation

- Local startup and configuration
- Storage structure
- Troubleshooting
- Rust API architecture boundaries
- Current main chain
- Stage execution contract
- OCR Provider contract
- Render parameters contract
