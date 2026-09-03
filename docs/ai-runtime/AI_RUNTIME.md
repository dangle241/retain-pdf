# RetainPDF AI Runtime Design

**Status:** Design Draft v0.1  
**Date:** 2026-07-21  
**Scope:** `backend/ai_service`（retainpdf-ai) and Rust / Frontend contract  
**Out of scope:** OCR/Translation pipeline; specifics LLM Vendor lock-in

Included:

- [SESSION_AND_MEMORY.md](./SESSION_AND_MEMORY.md) — Multi-turn and Compression  
- [SKILLS.md](./SKILLS.md) — Skill package  

---

## 1. Motivation

Current `RetrievalAgent` Sufficient ãFull-text search + Jump to Referenceã However, the product roadmap still requires:

| Capabilities | Design now waste time. Ship feature first. Refactor later if needed. YAGNI. |
|------|------------------|
| **Skills** | Document Q&A / Annotation Assistant / Compare Texts… Can't fit all in one. system prompt |
| **Tool invocation** | Already exists function calling; needs versioning, permission scopes, budgets, observability |
| **Context compression** | After multiple rounds `history[-12:]` Will crash. token Discard evidence structure |
| **Multi Agent** | Split retrieval and writing; optional criticAvoid single-loop bloat ponytail: ceiling O(n²) → switch to divide-and-conquer when n > 1e4 |

Constraints (unbreakable):

1. **Rust Data plane manifest writer**（documents / FTS / conversations / favorites）。  
2. **AI Prefer stateless services.**restartable; session persistence handled by Rust。  
3. **Local single-user**Priority: latency and controllability > Cloud agent Platform completeness.  
4. Tool schemas are isomorphic with OpenAI-compatible tools, making it easy to swap the loop shell.

---

## 2. Layered architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (reader AI panel)                                 │
│  SSE: tool / answer_delta / compress / handoff / done       │
└───────────────────────────┬─────────────────────────────────┘
                            │ POST /api/v1/ai/ask  (Rust Proxy)
┌───────────────────────────▼─────────────────────────────────┐
│  Transport  app.py                                          │
│  Auth · SSE · Request validation · conversation_id pass-through               │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Orchestrator  (Postv0 Degenerates to「Run with defaults. skill」)        │
│  Select skill / Too many? agent / When to wrap up                         │
└───────┬─────────────────────┬───────────────────────────────┘
        │                     │
┌───────▼───────┐   ┌─────────▼─────────┐
│ Session/Memory│   │ RunBudget         │
│ Window·Summary·Evidence │   │ Rounds·Token·Wall clock   │
└───────┬───────┘   └─────────┬─────────┘
        │                     │
┌───────▼─────────────────────▼─────────┐
│  Agent Runtime(s)                     │
│  General tool loop · Event emission · Abort condition  │
└───────┬───────────────────────────────┘
        │
┌───────▼───────────────────────────────┐
│  Skills  →  Tools                     │
│  Declarative Capability Pack    Atomic action.               │
└───────┬───────────────────────────────┘
        │
┌───────▼───────────────────────────────┐
│  Data plane (Read-only AI View)            │
│  Rust HTTP · job directory md/ocr/translated│
└───────────────────────────────────────┘
```

| Layer | Responsibility | Current status | Objective |
|----|------|------|------|
| Transport | HTTP/SSE、Key | `app.py` | Keep thin; event types extensible. |
| Session/Memory | Multi-round, compressed. | history[-12:] original text | window + summary + evidence package |
| Orchestrator | Routing/Collaboration | None (single agent) | skill selection → optional multi-agent |
| Runtime | Tool Loop | `agent.py` | Extract reusable. loop |
| Skills | Strategy+Prompt+Tool Subset | hardcoded SYSTEM_PROMPT | Catalog skill package |
| Tools | atomic I/O | tools.py | add scope/timeout/version |
| Evidence | References/Figures | Citation dataclass | Unified protocol: frontend can route and render. |

---

## 3. Core Objects (Logical Model)

### 3.1 Run

An execution unit triggered by a single user query (can involve multiple tool rounds or span across agents). agent）。

```text
Run
  run_id            Runtime generation (log/SSE Link)
  conversation_id   Persistent Session (Optional)
skill_id          default literature-qa
  scope             { document_id?, job_id? }
  budget            RunBudget
  status            running | done | error | cancelled
  events[]          Observable Trace
  result            answer + evidence + usage
```

### 3.2 RunBudget

```text
RunBudget
max_tool_rounds      default 6 (existing RETAIN_AI_MAX_TOOL_ROUNDS)
max_wall_time_s      recommend 120
  max_input_tokens     Recommend using the model window. 60%
max_tool_calls       recommend 24
max_evidence_items   recommend 32 to retain upper bound when compressing.
```

When exhausted: force final round (existing「Please answer based on existing evidence.」Behavior retained.

### 3.3 EvidenceItemUnified Evidence

Frontend redirects, illustrations, and footnote references all use this form:

```text
EvidenceItem
  ref               int          # User-visible [n]
  kind              text | image | page_preview | favorite
  document_id
  job_id
  page_idx          0-based
  block_id? 
  snippet?          Short excerpt
  image_url?        /api/v1/jobs/.../markdown/images/...
  preview_url?      /api/v1/jobs/.../preview/pages/{1-based}
  source_tool       search_fulltext | read_blocks | ...
  created_round     int
```

citations[] is a subset view of EvidenceItem where kind=text.

### 3.4 Transcript Message (session storage)

See SESSION_AND_MEMORY.md. Key point: besides user/assistant, allowed system_summary and evidence_snapshot metadata fields (may reside in assistant message JSON extension, or as standalone message kind).

---

## 4. Event stream (SSE Contract)

Backward compatible with existing types; new optional types can be ignored by frontend.

| type | When | payload key points |
|------|------|----------------|
| `tool` | Before/After Tool Call | `tool`, `round`, `arguments?`, `status?` |
| `answer_delta` | final answer streaming | `text` Incremental or Cumulative (**Implementation must fix one type.**Current status accumulation full text. Optimize. |
| `compress` | Compression occurs. | `dropped_turns`, `summary_chars`, `kept_evidence` |
| skill | skill switch/load | skill_id, phase: start\|end |
| `handoff` | agent Handover | `from`, `to`, `reason` |
| `done` | Success | `answer`, `citations`, `tool_trace`, `rounds`, `usage?`, `memory?` |
| error | Failure | message, code? |

**Compatibility rules:** Legacy frontend recognizes only `tool` / `answer_delta` / `done` / `error` Done.

---

## 5. Skills and Tools boundary.

```text
Tool  = Atomic Action (has schemaUnit tests. Audit trail.
Skill = Tool subset + system/developer prompt + strategy (scope lock, output format, allow list_documents)
```

See [SKILLS.md](./SKILLS.md)。

Initial Release skill：

| skill_id | Purpose | Tools |
|----------|------|------|
| `literature-qa` | reader full-book Q&A (current behavior) | search_fulltext, read_blocks, search_favorites（scoped） |

Future candidates:`annotation-assist`、`paper-compare`、`glossary-extract`。

---

## 6. Multi-agent (Phase D interface placeholder)

v0 / v1 do not force multi-agent.** API reserved:

```text
AgentRole
  id: retriever | analyst | critic
  skill_id or tool_allowlist
  model_override?

Handoff
  from_role → to_role
  payload: { evidence_refs[], question, notes }
```

Recommended Evolution:

1. Single runtime + literature-qa now
2. **Pipeline** Retriever → Analyst(Same evidencedifferent prompt）  
3. **Optional Critic** check for "no [n] assertion"
4. Also consider parallelism. fan-out(Multi-document)

Orchestrator can use simple state machine; no need for graph execution engine upfront.

---

## 7. Package structure goals

```text
backend/ai_service/retainpdf_ai/
  app.py                 # Transport
  config.py
  rust_client.py
  tools/                 # Or retain tools.py Split further.
    registry.py
    literature.py        # search/read/favorites
  skills/
    loader.py
    literature_qa/
      skill.yaml
      prompt.md
  runtime/
loop.py              # extracted from agent.py
    budget.py
    events.py
  memory/
    assemble.py          # assemble messages messages
    compress.py          # Summary + Crop
  orchestrator/
default.py           # v0: directly run skill
  evidence/
    model.py
    assign_refs.py
agent.py               # transition period facade → call runtime
```

During migration **`POST /v1/ask` Maintain path and field compatibility**Internal refactor call chain.

---

## 8. Boundary with Rust / Frontend

### Rust

- Continue:`/api/v1/ai/ask` proxy,conversations CRUD、messages Add  
- Extensions (B Required): message may carry `metadata_json`（summary / evidence_snapshot / skill_id）  
- AI does not write to SQLite

### Frontend

- Pass: question, document_id/job_id, conversation_id, stream, LLM credentials
- Consumption: SSE + citations + image hydrate (already done)
- Post-production: Display compress Prompt:skill Name, multi-session list (reusable) Rust conversations）

### AI Service

- Read: Rust search/documents/favorites + job directory
- By approval only. Rust append conversation messages  

---

## 9. Security and Policies

| Strategy | Description |
|------|------|
| Document scope | Force Reader Session `document_id`tool layer injection (existing `_scope_tool_arguments`） |
| No implicit full-library imports. | When there is job but no document, fail closed (existing) |
| Tool Side effects | v1 tools All read-only; write operations (e.g., modifying favorites) require explicit action. skill + confirmation |
| Secret key | LLM key Can be issued per request; do not write. job snapshot / No echo. |
| Cite honestly | system prompt requires facts to include [n]Optional critic Post-check |

---

## 10. Test strategy

| Layer | What to test |
|----|--------|
| tools | schema, handler Pure function, Pure function, Pure function. Pure function, image_urls path |
| runtime loop | mock chat_fnTool Wheel → Final round. → budget Exhausted |
| memory | After window cropping and summary replacement token Descend, evidence preserved |
| app SSE | Event order, done includes citations |
| Contract | OpenAPI/Examples and Frontend mock Consistent |

Not enforced. e2e Main Event DeepSeek；mock chat That's all.

---

## 11. Phased rollout (PR Granularity)

| Phase | Delivery | User-visible |
|-------|------|----------|
| **C** | This documentation set | None |
| **B1** | Session protocol + frontend `conversation_id` integration | Multi-turn with memory |
| **B2** | Memory Compress pipeline + `compress` event | Long chat, no context blowup, promptable. "Compressed" |
| **S1** | Skill Loading + literature-qa External | Behavior similar, hot-addable. skill |
| **D0** | Orchestrator placeholder + optional analyst Split | Answer quality/Hoisting |

Maintain per phase. `/v1/ask` Maintain compatibility; deprecate path with a minor version window.

---

## 12. Intentionally skipped (this phase)

- Bind specific agent Framework is the sole implementation.  
- AI Service writes to local business database.  
- Unlimited agent no budget Dialogue
- Reimplement frontend. tool protocol
- Cloud multi-tenant routing (not current product form)

---

## 13. Decision records (open issues)

| ID | Issue | Preference | Status |
|----|------|------|------|
| D1 | `answer_delta` Incremental or cumulative? | **Pin cumulative full text**In line with current implementation, hardcoded in docs. | Approve |
| D2 | summary Where is it stored? | assistant Bypass `metadata_json` or kind=`summary` message | See Session doc |
| D3 | For compression LLM Or extractive? | v1 **Extractive**(Quote+Issue keywords); v2 optional LLM summary | Recommended approval |
| D4 | multi-agent Enabled by default? | Default off. feature flag / skill config | Recommend approval. |

---

## 14. Reference code anchor

| Path | DeepSeek. |
|------|------|
| `backend/ai_service/retainpdf_ai/agent.py` | Current Loop / Reference Number |
| `backend/ai_service/retainpdf_ai/tools.py` | Atomic Tools |
| `backend/ai_service/retainpdf_ai/app.py` | SSE / history / persist |
| `backend/ai_service/retainpdf_ai/rust_client.py` | Session and Search Client |
| `frontend/.../use-reader-ask-runtime.ts` | Frontend consumption ask |
| `frontend/.../answer-enhance.ts` | Reference Navigation and Graph |
