# Session Context compression (Draft B)

**Status:** API / Data shape draft v0.1 Â· **B1 + B2 Landed**
**Date:** 2026-07-21
**Dependencies:** [AI_RUNTIME.md](./AI_RUNTIME.md)  
**Goal:** Multi-turn usable; long chat avoids context overflow; evidence (citations)/Fig) Cross-turn reusable  

### B1 Implementation Summary

| Item | Position |
|----|------|
| AI auto-create + `done.conversation_id` | `retainpdf_ai/app.py` |
| Rust create client | `retainpdf_ai/rust_client.py` |
| Frontend Sticky Storage | `frontend/src/js/reader/ai/conversation-store.ts` |
| ask send/receive conversationId | `api/ai.ts` + `ask-answerer.ts` |

### B2 Implementation Summary

| Item | Location |
|----|------|
| Extractive Compression `extractive_v1` | `retainpdf_ai/memory/compress.py` |
| Window Assembly | `retainpdf_ai/memory/assemble.py` |
| SSE `compress` + `done.memory` | `retainpdf_ai/app.py` |
| Configuration | `RETAIN_AI_MEMORY_WINDOW_TURNS` etc. (see config.py) |
| Persist summary to database. | assistant message, with body starting with `ãå¯¹è¯æè¦ã` Start |


---

## 1. Current state and gaps

### 1.1 Existing

| Capability | Location |
|------|------|
| Rust Session CRUD | `/api/v1/ai/conversations` |
| Append Message | `.../messages`（user/assistant + citations_json + tool_trace_json） |
| AI Read history | `load_history` â **Recently 12 items** `role+content` |
| AI Write back | `persist_turn` write user + assistant |

### 1.2 Gap

1. Frontend reader **Often omitted / Do not create `conversation_id`** → Actually multi-turn stateless.  
2. History **Paste source text only.**Bug in auth middleware. Token expiry check use `<` not `<=`. Fix: `if (now < expiry)` â skipped: strict `<=`, add when spec changes. evidence package â Long = expensive + structure loss.
3. `tool_trace` Persisted but **No model backfill**Evidence keep.  
4. No **Compress events**User doesn't know "Early rounds summarized.".
5. No unified **memory view**(for runtime `messages[]` To storage transcript Not layered).

---

## 2. Conceptual hierarchy

```text
TranscriptPersist,Rust）
  = User-visible full conversation history (may contain summary Message)

MemoryView(runtime,AI in-memory assembly)
= Current round input LLM `messages[]`
  = f(Transcript, EvidenceStore, CompressPolicy)

EvidenceStore(runtime + Optional snapshot storage)
  = Session cumulative EvidenceItem"(Press".(Press ref Or press content hash）
```

Principle:

- **Transcript Seek truth**(Replayable) UI）  
- **MemoryView Seek savings.**(truncatable, replaceable with summary）  
- **Evidence Prioritize stability.**（[ n ] Keep anchor cross-round stable.

---

## 3. Data shape

### 3.1 Conversation（Rust, already extensible)

```json
{
  "conversation_id": "conv_...",
  "document_id": "doc_...",
  "job_id": "2026...",
  "title": "Auto Title (optional)",
  "skill_id": "literature-qa",
  "created_at": "...",
  "updated_at": "..."
}
```

Extension Fields (recommended):

| Field | Description |
|------|------|
| `document_id` / `job_id` | Session Default scope(Written at reader creation) |
| `skill_id` | Default skill |
| `memory_json` | Compression State (optional) `{ "summary": "...", "through_message_id": "..." }` |

### 3.2 Message（Rust）

Current roughly:`role`, `content`, `citations_json`, `tool_trace_json`, `model`, timestamps。

**Extension recommended. `metadata_json`Object serialization**：

```json
{
  "kind": "turn | summary | system_note",
  "run_id": "run_...",
  "skill_id": "literature-qa",
  "evidence_refs": [1, 2, 5],
  "usage": { "prompt_tokens": 0, "completion_tokens": 0 },
  "compress": {
    "covers_message_ids": ["m1", "m2"],
    "policy": "extractive_v1"
  }
}
```

| kind | Suggested role | Purpose |
|------|-----------|------|
| `turn` | user / assistant | Normal Q&A (Default) |
| `summary` | `assistant` or dedicated `system` | Compressed history summary (UI Collapsible "Compressed N rounds") |
| `system_note` | system | Debug/Policy description; hidden from users by default. |

**Compatibility:** No `metadata_json` Treat old messages as `kind=turn`.

### 3.3 EvidenceSnapshot(can be embedded in assistant metadata or standalone table)

```json
{
  "items": [
    {
      "ref": 1,
      "kind": "text",
      "document_id": "doc_x",
      "job_id": "job_y",
      "page_idx": 3,
      "block_id": "p004-b0012",
      "snippet": "……",
      "image_urls": ["/api/v1/jobs/job_y/markdown/images/page-4/imgs/..."]
    }
  ],
  "ref_counter": 6
}
```

Within same session **ref Monotonically increasing; no reclamation.**Avoid.「[2] Previous round was A this round is B」）。  
If recycling is required,UI Show only this round. `citations`historical bubble bound at that time snapshot。

---

## 4. Memory Assembly algorithm (B2 Core)

### 4.1 Input

```text
assemble_memory(
  transcript: Message[],
  scope: { document_id, job_id },
  skill: Skill,
  budget: TokenBudget,
) -> { messages: ChatMessage[], evidence: EvidenceItem[], debug }
```

### 4.2 Strategy `extractive_v1`Default, no dependencies. LLM Summary

```text
1. Separation:
   - summaries = kind==summary Messages (by time)
- turns = user/assistant pairs where kind==turn

2. Get "latest summary" S (if any), overrides previous content through a certain message_id.

3. Recent window W:
- Get turns after S, then truncate to the most recent K Round (default) K=6 rounds = 12 messages)
   - Single content Need full source text. clip（user 2k / assistant 3k Character hard top)

4. Evidence package E:
- Merge assistant citations / evidence_snapshot within W
- Limit max_evidence_items (Default 24)
- Prioritize keeping: those referenced in the most recent round ref > Newer > those with image_urls

5. assemble messages：
   [ system = skill.system_prompt + scope_lock_text ]
   [ developer? = skill.developer ]
   if S: [ {role:user, content: "以下是更早对话的摘要，请当作已知背景：\n"+S.content } ]
          [ {role:assistant, content: "Ready." } ]  # Optional stable prefix
   for m in W: append role/content
   if E:  append Hidden item revealed./user Tool-style context? → No;
          Change to system Attached at end. "Known Evidence Table"：
          "E1 [1] p.4 block … snippet"
          (controlled within ~2k characters)

6. If estimating tokens > budget：
   - Subtract first. K(Window)
   - Shorten snippet further snippet
   - Trigger again compress_now() Generate new summary(see 4.3）
```

### 4.3 When to compress `compress_now`

Trigger (any):

- `len(turns) > 2K`(e.g., 12 turn)  
- Estimate prompt tokens > `0.55 * context_window`  
- explicitly request `force_compress: true`

**extractive Summary content template:**

```text
ãConversation Summaryã
- User focus: ...
- Confirmed conclusion:…(attached [n] if any
- Unresolved issues:…
- Key evidence:
  [1] p.3 … 
  [2] p.7 …
```

Generation method v1：

1. From collapsed turns Extract: all user questions (truncated), all assistant sentences with [n]. citations
2. Rule concatenation,**No call LLM**Stable, cheap, testable.  
3. v2 Optional: LLM summary skillFallback on failure. v1

After compression:

1. Append `kind=summary` message to Rust
2. Update `conversation.memory_json.through_message_id`
3. SSE emit `compress` event

### 4.4 Token Estimate

v1 Use cheap estimation:`tokens ≈ chars / 3`(conservative for mixed Chinese-English can `/2.5`）。  
Do not force tiktoken to avoid heavy dependencies in AI Service.

---

## 5. API Shape

### 5.1 Maintain compatibility:`POST /v1/ask`（retainpdf-ai）

```json
{
  "question": "……",
  "document_id": "doc_…",
  "job_id": "job_…",
  "conversation_id": "conv_…",
  "stream": true,
  "skill_id": "literature-qa",
  "force_compress": false,
  "llm_api_key": "",
  "llm_base_url": "",
  "llm_model": ""
}
```

| Field | Current | After B |
|------|------|------|
| `conversation_id` | Optional | **Reader should always carry**(if missing, backend can auto-create and return in done) |
| `skill_id` | None | Optional, default `literature-qa` |
| `force_compress` | None | Optional |
| `history` Client direct upload | None | **Discouraged**; based on server-side read Rust Authoritative (prevent dual-source). |

### 5.2 `done` Extensions (optional field)

```json
{
  "type": "done",
  "answer": "……",
  "citations": [ /* Evidence Subset */ ],
  "tool_trace": [ /* this run */ ],
  "rounds": 3,
  "conversation_id": "conv_…",
  "run_id": "run_…",
  "memory": {
    "window_turns": 6,
    "had_summary": true,
    "evidence_count": 8,
    "compressed": false
  },
  "usage": {
    "prompt_tokens_est": 4200,
    "completion_tokens_est": 600
  }
}
```

### 5.3 New SSE: `compress`

```json
{
  "type": "compress",
  "dropped_turns": 8,
  "summary_chars": 900,
  "kept_evidence": 12,
  "policy": "extractive_v1"
}
```

### 5.4 RustCreate session (reader opens AI or on first question)

```http
POST /api/v1/ai/conversations
{
  "document_id": "doc_…",
  "job_id": "job_…",
  "title": "",
  "skill_id": "literature-qa"
}
→ { "conversation_id": "conv_…" }
```

### 5.5 RustAppend Message (Extension

```http
POST /api/v1/ai/conversations/{id}/messages
{
  "role": "assistant",
  "content": "……",
  "citations_json": "[…]",
  "tool_trace_json": "[…]",
  "model": "…",
  "metadata_json": "{ \"kind\": \"turn\", \"run_id\": \"…\" }"
}
```

Summary Message:

```json
{
  "role": "assistant",
"content": "ãConversation Summaryã...",
  "metadata_json": "{\"kind\":\"summary\",\"compress\":{\"policy\":\"extractive_v1\",\"covers_message_ids\":[…]}}"
}
```

### 5.6 Frontend reader workflow (target)

```text
open AI panel
  if !conversationId for (jobId|documentId):
      create conversation → store in memory/localStorage key
ask(question):
  POST ask with conversation_id + job_id + document_id
  on compress → Optional toast「Compressed earlier conversations」
on done â render answer + citations; remember conversation_id
```

Storage key suggestion:`retainpdf.reader.ai.conversation.v1:{jobId}`。

---

## 6. Runtime Pseudocode

```python
def ask(question, *, conversation_id, scope, skill_id, budget, force_compress=False):
    skill = load_skill(skill_id)
    transcript = rust.list_messages(conversation_id, limit=200)

    if force_compress or should_compress(transcript, budget):
        summary_msg = build_extractive_summary(transcript, budget)
        rust.append_message(conversation_id, summary_msg)
        emit({"type": "compress", ...})
        transcript = rust.list_messages(conversation_id, limit=200)

    mem = assemble_memory(transcript, scope, skill, budget)
    result = run_tool_loop(
        messages=mem.messages,
        tools=skill.tools,
        budget=budget,
        evidence_seed=mem.evidence,
        on_event=emit,
    )
    rust.append_message(user)
    rust.append_message(assistant + citations + metadata)
    emit({"type": "done", **result, "conversation_id": conversation_id, "memory": mem.debug})
    return result
```

---

## 7. Relation to reference number

| Rule | Description |
|------|------|
| Within single run | current ` _assign_refs` Same, from 1 Or from `ref_counter+1` from |
| Cross-run run | **Continue incrementing**(Read last snapshot `ref_counter`) |
| In the answer [n] | Must fall on this. run Visible evidence Or Known Evidence Table |
| After compression | Keep in summary. [n] and snippetOld bubble UI Still shows that time. citations |

---

## 8. Test plan (B）

| Use Cases | Expected |
|------|------|
| No conversation_id | Behavior matches production (single-turn); or auto-create and return in done |
| With conversation_id Keep Asking 2 rounds | Round 2 memory including the first round user/assistant |
| 15 Compress after rotation. | Appear summary Messageassemble No longer contains full original text. |
| evidence limit | Exceeds max Drop oldest unreferenced items. |
| scope lock | memory system contains document_idTool parameters are injected. |
| Character clip | Overlong assistant Truncated, no crash. JSON |

---

## 9. Phased implementation checklist

### B1 — Session Code refactor. Remove redundant. Test.

- [ ] Frontend: Create/reuse `conversation_id` Follow ask upload
- [ ] Backend: done Echo `conversation_id`
- [ ] Rust: conversation support `document_id`/`job_id`/`skill_id`If none
- [ ] Documentation + Unit test: history Injection count

### B2 — Memory Compress

- [ ] `memory/assemble.py` + `memory/compress.py`  
- [ ] `metadata_json` Read/Write  
- [ ] SSE `compress`  
- [ ] Estimate token and budget Configuration Items
- [ ] Unit test: before and after compression messages Length  

### B3 — Evidence Cross-turn

- [ ] snapshot Write to database / Recharge "Known Evidence Table"
- [ ] ref_counter persistence

---

## 10. Configuration items (recommended env）

| Variable | Default | Description |
|------|------|------|
| `RETAIN_AI_MEMORY_WINDOW_TURNS` | `6` | Recent rounds to keep |
| `RETAIN_AI_MEMORY_MAX_CHARS` | `24000` | MemoryView Coarse upper limit |
| `RETAIN_AI_MEMORY_COMPRESS_AFTER_TURNS` | `12` | Compress if exceeded |
| `RETAIN_AI_MEMORY_MAX_EVIDENCE` | `24` | Evidence Count |
| `RETAIN_AI_MEMORY_POLICY` | `extractive_v1` | Compression Policy Name |

---

## 11. Open decision

| ID | Question | Suggestion |
|----|------|------|
| M1 | auto-create when no conversation_id? | **Yes**Reduce frontend state machine.done Must return. |
| M2 | summary whether in UI Display? | Default collapse one line. "Summarized previous N rounds" |
| M3 | tool_trace Enter? memory? | **No**Only allow inbound. evidence With this run trace |
| M4 | Allow client transmission? history? | v1 **Ignore** client historyAvoid forks |

---

## 12. Acceptance Criteria (B On completion)

1. Continuous queries on same reading task 5 Times, ordinal 5 answers can cite the 1 Secondary conclusion or evidence.  
2. Manually extend history to 20 After polling, request still succeeds;SSE Appears at least once. `compress` or exists summary Message.  
3. After compression citations Redirect still correct (page_idx 0 Base).
4. When old frontend does not send new field, behavior does not fall back. 5xx。  
