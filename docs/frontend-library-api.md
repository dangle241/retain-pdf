# Frontend Integration Notes:Library data layer API

> Backend Submit:`9b22e26`(Library Data Layer:documents First-class citizen + Anchor Bookmarks + FTS5 Full-text search)
>
> Existing `/api/v1/library/books` interface **Keep as-is**,Migrate library page incrementally.,No migration needed; system remains stable.
> All new APIs follow same flow as existing. `X-API-Key` authentication,Unified Response `{code, message, data}` Packaging.

## Core Concepts(Only model change frontend needs to understand)

- **document = a PDF stable identity**(By file content sha256 deduplication):Same article. PDF Regardless of upload attempts,
  translated multiple times,All the same. `document_id`。job Now under the document name."Processing Records"。
- **Anchor**:Include in favorites and search hits. `(document_id, job_id, page_idx, block_id)` quadruple,
  `job_id + page + block` Current reader positioning coordinates.,Jump directly to the original position.

## API list

### 1. Document list / Details / Edit

```
GET  /api/v1/documents?limit=50&offset=0&reading_status=reading&tag=Chemistry&collection_id=xxx
GET  /api/v1/documents?job_id=xxx          â Any job_id(including history run)Directly check the owning document.,Stop scanning list for reverse lookup. active_job_id
     → data.documents[]: { document_id, title, source_filename, page_count, bytes,
                           active_job_id, reading_status, tags[], added_at,
                           last_opened_at, updated_at, authors_json, year, doi }

GET  /api/v1/documents/:document_id

PATCH /api/v1/documents/:document_id
     body: { title?, reading_status?, tags? }
```

- `reading_status` Accept only `unread | reading | done`,Return other values. 400;
- `tags` is **Replace all** semantic(passing `[]` Clears immediately.);
- `active_job_id` This document's current effective processing. run——**Open reader, use it.**;
- Sort by `added_at` Reverse order,`limit` Upper bound 500。

### 2. Favorites

```
POST /api/v1/favorites
     body: {
       page_idx, block_id, quote_text,                      ← Required
       document_id?, job_id?,                               ← Select at least one of the two.
       char_start?, char_end?, kind?,
       translated_quote_text?, note?
     }
     → data: FavoriteRecord(Includes generated favorite_idParsed out document_id and anchored to the actual job_id)

GET  /api/v1/favorites?document_id=xxx
     → data.favorites[](Sort by page number;No parameters provided. = Favorite All,Reverse chronological order.)

PATCH /api/v1/favorites/:favorite_id
     body: { note }                          ← Atomic update notes,favorite_id Unchanged.
DELETE /api/v1/favorites/:favorite_id
```

- **Only provide `job_id`(including history run)Backend auto-parses parent doc and anchors to it. run's block space**â
  In reader, favorite passes current directly. job_id Done.,Open History job Also imports correctly.;
- Only provide `document_id` Time anchor `active_job_id`;
- `quote_text` Citation snapshot.,Required(Selected original text);`translated_quote_text` Upload together recommended.â
  Snapshot preserves content if anchor later fails.;
- `kind`: `sentence | data | figure`, default `sentence`;
- `char_start / char_end` In-block selection(Optional, No argument means entire block).

### 3. Full-text search

```
GET /api/v1/search?q=optical spectroscopy&limit=20
    → data.hits[]: { document_id, job_id, page_idx, block_id,
                     source_snippet, translated_snippet }
```

- snippet Match term usage wrapped in `[` `]`, Frontend replaceable with highlight tags.;
- Any length. `q` All queryable.(â¥3 Characters Move to FTS5 full-text index, Shorter auto-fallback to fuzzy matching.);
- `limit` upper bound 100.

### 4. AI Q&A(agentic Search, With clickable references)

> Frontend only. Rust API This entry:`/api/v1/ai/ask` Is to retainpdf-ai Service
> Reverse proxy,Authentication unchanged. X-API-Key,No new configuration needed.

```
POST /api/v1/ai/ask
     body: { question: string, document_id?: string, job_id?: string, stream?: boolean,
conversation_id?: string,             â Multi-turn conversation, See 6 section
             llm_api_key?: string, llm_base_url?: string, llm_model?: string }
```

- `job_id` (includes history runs) Replaceable `document_id`: Server parses associated document to restrict search scope.;
- `llm_*` Three fields from frontend credential settings, overwrite server by request. env config; return if key missing
400 "Please fill in the model API Key in the frontend credential settings".

**Non-streaming.**(`stream` Default false):Awaiting full response(agent Multi-turn retrieval,Usually 10-30 seconds)
```json
{ "code": 0, "data": {
    "answer": "…Answer text,Factual sentence [n] Citations…",
    "citations": [ { "ref": 1, "document_id": "…", "job_id": "…",
                     "page_idx": 3, "block_id": "p004-b0002", "snippet": "…" } ],
    "tool_trace": [ { "round": 1, "tool": "search_fulltext", "arguments": {…} } ],
    "rounds": 4
} }
```

**Streaming**(`stream: true`):SSE(`text/event-stream`),Per row `data: {json}`,Event Type:

| type | field | description |
|---|---|---|
| `tool` | round, tool, arguments | agent Push in real time on every tool call.——Render as"Searching:xxx"Process prompt |
| `answer_delta` | text | Final answer, item by item. token Incremental,Full-width rendering needed. Consider CSS flexbox or grid. → skipped: JavaScript solution, add when dynamic resizing required. |
| `done` | answer, citations, tool_trace, rounds | Final result(Same structure as non-streaming. data) |
| `error` | message | failure |

Frontend rendering essentials:
- in the answer text `[n]` corresponds to `citations[].ref`, render as clickable reference.; click to use
  `job_id + page_idx + block_id` jump to reader——**Shares anchor logic with favorites navigation.**;
- `document_id` Restrict to single-document Q&A on input.(In Reader"Ask about this document"),Full database search if none provided.;
- migration retired `tool` Semantic text content:`search_fulltext`→"Full-text search"、
`read_blocks`â"Read original context", `list_documents`â"Browse Library",
  `search_favorites`→"Search Favorites";
- AI Reverse proxy response when service is not started 502, prompt "AI Service not running".


### 5. Assets (Collect screenshot image attachments.)

```
POST /api/v1/assets                    â multipart, field name file(png/jpeg/webp, â¤20MB)
     → data: { asset_id, mime, bytes, created_at }
GET  /api/v1/assets/:asset_id          ← Content-addressed lookup; response carries immutable cache headers; safe to use directly as <img src>
```

- `asset_id` = file sha256: Duplicate image uploads auto-merge, get same id;
- **Image bookmarking flow**: canvas Export PNG â POST assets get asset_id â POST favorites Time zone
`asset_id` (suggest `kind: "figure"`) and `rect_json` (Preserve cropped rectangle geometry, restorable on device change.);
- favorites Record the return now. `asset_id` / `rect_json` fields, empty string = text-only favorite.

### 6. AI Q&A Session (Historical storage + multi-turn dialog)

```
POST   /api/v1/ai/conversations                      body: { title?, document_id? }
GET    /api/v1/ai/conversations?limit=50&offset=0    → data.conversations[](contains message_count,Newest first)
GET    /api/v1/ai/conversations/:id                  → Session Fields + messages[](seq Ascending)
DELETE /api/v1/ai/conversations/:id                  Cascade Delete Messages
POST   /api/v1/ai/conversations/:id/messages         body: { role, content, citations_json?, tool_trace_json?, model? }
```

- **Frontend multi-turn dialog integration: one step.**:Create session first. `conversation_id`,Every time thereafter `/api/v1/ai/ask`
  Take it.——Server automatically injects previous rounds as context, and after answering automatically user/assistant two lines
Add to history (**Frontend doesn't need to call messages API**, that is AI Service writeback.);
- In the message `citations_json` Array of anchor snapshots. (Same structure as citations returned by ask), render history
  Also clickable to navigate.;
- **Soft anchor semantics**: Q&A citations do not prevent job deletion (differs from favorites 409 protection), job redirect after deletion.
  Invalid but snippet Text remains.——Render navigation fails. Gracefully degrade to text-only display.;
- Auto title from first question 40 character,Configurable on creation. `title` override.

### 7. Category (Collection): Create folder for PDF grouping

> `collections`/`collection_documents` Table created with library data layer.,No action.
> Routing;Now add it.v1 Only flat folders.(Unsupported nested.,`parent_id` Submit and Accept,
> but frontend doesn't need it yet)。

```
POST   /api/v1/collections                body: { name, parent_id? }
GET    /api/v1/collections                â data.collections[] (sort by sort_order, includes document_count)
PATCH  /api/v1/collections/:id             body: { name?, sort_order? }
DELETE /api/v1/collections/:id             ← Delete only the folder itself.,Documents unaffected.

POST   /api/v1/collections/:id/documents              body: { document_ids: [...] }
DELETE /api/v1/collections/:id/documents/:document_id
```

- Add non-existent `document_id` returns 404; idempotent re-add of same document. (Does not error. Does not double-count.);
- List documents in folder.: `GET /api/v1/documents?collection_id=xxx` (see section 1),
  In each retrieved record. `active_job_id` Available processing records for current document.;
- If the frontend still uses the old `/api/v1/library/books` to render cards (instead of `/api/v1/documents`
projection), use previous step output. `active_job_id` merge into newly added. `job_ids` parameter
(comma-separated, see the pair below. `/api/v1/library/books` description), then you can get with the homepage library.
Card-isomorphic data, no extra copy needed. "Folder Details Card" rendering.

### `/api/v1/library/books` Add optional parameter.:`job_ids`

```
GET /api/v1/library/books?job_ids=job-a,job-b,job-c
```

- comma-separated job_id allowlist,Return only matched records.,Shape identical to when parameter omitted.;
- Keep current if omitted. (pagination `limit`/`offset`), delta-only parameter, does not affect any existing callers.;
- Passed `job_ids` no pagination truncation. ââ Semantics: "give me exactly these jobs", not "which page?".

## Two mandatory edge cases

1. **Delete protection**: When deleting book (`DELETE /api/v1/library/books/:job_id`), if this job is bookmarked
reference, backend response **409**, message contains reference count ââ frontend must display this error as
"This document has N Favorites, delete favorites first.", instead of a generic error.
2. **Duplicate upload**: Re-uploading the same PDF does not create a new document (documents list count unchanged),
   Frontend should not assume"Upload successful = List has one extra item."。

## Suggested migration path(Optional)

1. **Step 1: incremental only**: Reader add "Select â Favorite" and favorites sidebar (new only, leave existing pages untouched).
   Favorite Redirect:Use the one in the anchor. `job_id + page_idx + block_id` Reuse existing reader positioning.
2. **Step 2** (deferred): switch the projection from `/api/v1/library/books` to `/api/v1/documents`,
   Get Tag / Read status / Collections

## appendix:Field quick reference

| field | description |
|---|---|
| `document_id` | file content sha256(hex),Stable |
| `active_job_id` | Currently active processing run,Reader Entry |
| `job_id` (Favorite/Hit Rate) | Version of the block space containing the anchor. |
| `block_id` | `document.v1.json` Block ID,such as `p001-b0002` |
| `page_idx` | 0 Starting page |
| `reading_status` | `unread` / `reading` / `done` |
| `kind` (Favorite) | `sentence` / `data` / `figure` |
