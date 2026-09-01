# RetainPDF AI RuntimeDesign doc index.

**Status:** Design draft (C Architecture + B Session/Compress
**Date:** 2026-07-21
**Current code state:** `backend/ai_service` For stateless thin loop (`RetrievalAgent` + `ToolRegistry`）  
**Product entry point:** Reader full-book Q&A. → Rust Proxy `POST /api/v1/ai/ask` → retainpdf-ai `:41100`

---

## Documentation

| Document | Content |
|------|------|
| **[AI_RUNTIME.md](./AI_RUNTIME.md)** | Target architecture:Transport / Session / Orchestrator / Runtime / Skills / Evidence |
| **[SESSION_AND_MEMORY.md](./SESSION_AND_MEMORY.md)** | Multi-turn session protocol, context compression,API Data shape mismatch.B detailed draft) |
| **[SKILLS.md](./SKILLS.md)** | Skill Package format, Tool boundary, and first `literature-qa` example |

---

## One-sentence goal

> **AI Service orchestrates only.Rust Manage data & permissions; tool shape aligns with mainstream SDK IsomorphicSkills / Memory / Multi-agent Plugin architecture enables incremental integration, avoiding full rewrite.**

---

## Relationship to current state

```
Current status（MVP）
POST /v1/ask â RetrievalAgent Bare loop â 4 tools â answer + citations

Goal (Extensible) runtime）
  POST /v1/runs  → Orchestrator
ââ Session/Memory(Window) + Summary + evidence Package)
                    ├─ Skill(s)（literature-qa / …）
ââ Agent loop(s)(Search) / Analysis / Optional critic)
                    └─ Evidence(anchors, figures, jump links)
```

Migration strategy: default skill Still today's full-book retrieval Q&A; new capabilities as skill/tool Add**Don't hardcode binding.** LangGraph/Crew Equal-weight framework.

---

## Implementation order (suggested)

1. **Freeze document API** ✅（C + B Draft  
2. Session Integration (B1) ✅ auto-create + Frontend stickiness + done callback
3. Memory Compress (B2) ✅ window + extractive summary + SSE compress
4. Skill Loader + Finalize `literature-qa`
5. Orchestrator + Second agent(Optional)  

Each step independently mergeable, revertible, non-blocking. `/v1/ask`。
