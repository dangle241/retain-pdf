# retainpdf-ai

Persistent AI Service:Library agentic Retrieval QA. Stateless.——Data plane(documents /
favorites / FTS)Return Only Rust API managed by,This service has been HTTP read;Block Text Direct-Read Task Directory
Output(Read-only)。

## Architecture

```
POST /v1/ask ──▶ RetrievalAgent(Thin loop,DeepSeek function calling)
                    │  Tool Registry(with mainstream agent SDK Isomorphic. name+schema+handler)
                    ├── list_documents    → Rust /api/v1/documents
                    ├── search_fulltext   → Rust /api/v1/search(FTS5 Anchor hit. Scroll smoothly.)
âââ read_blocks       â data/jobs/<job>/{ocr,translated}(read-only)
                    └── search_favorites  → Rust /api/v1/favorites
Back:answer + citations[](with document/job/page/block Anchor,Jump Reader)+ tool_trace
```

Deliberately unused agent Framework: single providerSingle-user local service, Bare loop takes full timeout control./
Rounds/Reference number;Tool definition isomorphism,Future migration: replace only the loop shell.

## Run

```bash
RETAIN_AI_API_KEYS=dev-local-key \
RETAIN_AI_RUST_API_KEY=dev-local-key \
RETAIN_AI_LLM_API_KEY=sk-... \
python3 -m retainpdf_ai
# Default 127.0.0.1:41100;at backend/ai_service Run in directory.
```

Environment variables(All have default values.,Credentials excluded.):

| Variable | Default | Description |
|---|---|---|
| `RETAIN_AI_API_KEYS` | Required | This service's X-API-Key Collection(Comma-separated.) |
| `RETAIN_AI_RUST_API_KEY` | Required | Call Rust API of key |
| `RETAIN_AI_LLM_API_KEY` | Required | DeepSeek(Or compatible endpoint)key |
| `RETAIN_AI_RUST_API_BASE` | `http://127.0.0.1:41000` | Rust API Address |
| `RETAIN_AI_LLM_BASE_URL` | `https://api.deepseek.com/v1` | LLM endpoint |
| `RETAIN_AI_LLM_MODEL` | `deepseek-v4-flash` | DeepSeek. |
| `RETAIN_AI_PORT` | `41100` | Listen port |
| `RETAIN_AI_MAX_TOOL_ROUNDS` | `6` | agent Maximum tool rounds |
| `RETAIN_AI_MEMORY_WINDOW_TURNS` | `6` | Recent conversation turns retained |
| `RETAIN_AI_MEMORY_COMPRESS_AFTER_TURNS` | `12` | If exceeded, apply extractive compression to early rounds. |
| `RETAIN_AI_MEMORY_MAX_CHARS` | `24000` | Model input history Character limit |
| `RETAIN_AI_DATA_ROOT` | `<repo>/data` | Task artifact root directory |

## Call Examples

```bash
curl -s -X POST http://127.0.0.1:41100/v1/ask \
  -H "X-API-Key: dev-local-key" -H "Content-Type: application/json" \
  -d '{"question": "Which paper in the database discusses halogen-lithium exchange selectivity??What is the conclusion??"}'
```

## Test

```bash
cd backend/ai_service && python3 -m pytest tests/ -q
```
