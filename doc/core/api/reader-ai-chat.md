# Reader AI Chat API

RetainPDF Backend provides a minimal but extensible reading Q&A interface. Frontend does not pass model keys; backend reads only server-side environment variables.

## Endpoint

`POST /api/v1/jobs/{job_id}/reader/ai/chat`

## Request

```json
{
  "message": "What is the core contribution of this article?",
  "scope": "document",
  "provider": "deepseek",
  "model": "deepseek-chat",
  "api_key": "sk-...",
  "base_url": "https://api.deepseek.com/v1",
  "context": {
    "page": 3,
    "selection": {
      "page": 3,
      "rect": { "left": 120, "top": 240, "width": 300, "height": 180 }
    },
    "mode": "compare"
  },
  "history": [
    { "role": "user", "content": "Summarize first" },
    { "role": "assistant", "content": "..." }
  ]
}
```

Current first version supports only scope=document. context and history are optional. context.page / selection.page are used as weighted retrieval clues.

Model config fields optional:

- provider: optional, default deepseek, supports deepseek / openai.
- model: optional; DeepSeek default is deepseek-chat.
- `api_key`: Optional; frontend value takes precedence. Backend does not write. job snapshot、events or return body.
- `base_url`: Optional,DeepSeek 默认 `https://api.deepseek.com/v1`。

## Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "answer": "This article mainly proposes...",
    "citations": [
      {
        "title": "Introduction",
        "page": 1,
        "snippet": "..."
      }
    ],
    "used_context": {
      "source": "markdown",
      "scope": "document"
    }
  }
}
```

## Backend Behavior

Version 1 process:

1. 根据 `job_id` Prioritize reading local structured translation artifacts.`jobs/{job_id}/translated/translation-manifest.json` and the pages it references payload。
2. From each page payload, extract page_idx/page_number, title, role, and render_markdown/translated_text to generate page-aware chunks.
3. If structured translation output missing or empty, then fallback Go to Published Markdown：`jobs/{job_id}/md/full.md`, split by headings and paragraphs chunk。
4. Select retrieval strategy based on user query:
   - General: lightweight keyword retrieval, fetch. top 8 chunk。
   - General summary issue: from Abstract / Introduction / Methods / Results / Discussion / Conclusion Priority representatives for chapters, etc. chunkand uniformly sample the full text to avoid hitting only the first page.
5. Send chunks, user question, and limited history to the reading QA model.
6. Return model answer and backend-retrieved reference snippets.

Note: When using translation-manifest.json, citations[].page should come from page_number or page_idx + 1 of each page payload. When falling back to full.md, page numbers may be inferred from Markdown text; if not possible, use null.

## Configuration

Frontend can pass directly in request body. `api_key`Request body missing. Fallback to server env vars.

```bash
RETAINPDF_AI_PROVIDER=deepseek
RETAINPDF_AI_MODEL=deepseek-chat
DEEPSEEK_API_KEY=...
```

Optional:

```bash
RETAINPDF_AI_BASE_URL=https://api.deepseek.com/v1
RETAINPDF_AI_API_KEY=...
```

Priority:

1. In the request body `provider/model/api_key/base_url`
2. Server environment variables `RETAINPDF_AI_PROVIDER/RETAINPDF_AI_MODEL/RETAINPDF_AI_API_KEY/RETAINPDF_AI_BASE_URL`
3. Provider defaults

Default provider is deepseek, also supports openai. RETAINPDF_AI_API_KEY is a general override; if unset, deepseek reads DEEPSEEK_API_KEY, openai reads OPENAI_API_KEY.

## Error Codes

- 404: job does not exist, Markdown missing/unreadable.
- 409: task not yet completed, Markdown not ready.
- `429`: Model service rate limiting.
- `502`: Model service failed or returned invalid response.
- 500: backend internal error, e.g., AI provider not configured.
