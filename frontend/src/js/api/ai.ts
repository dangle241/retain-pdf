import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { API_PREFIX } from "../config/api-constants.js";
import { unwrapEnvelope } from "../job/core.js";
import { buildApiEndpoint } from "./http.js";

// Library AI Q&A (POST /api/v1/ai/ask, SSE streaming).
// Use streaming fetch rather than EventSource:EventSource Cannot carry X-API-Key request headers.

export class AiAskError extends Error {
  status: number;
  constructor(message, status = 0) {
    super(message);
    this.name = "AiAskError";
    this.status = status;
  }
}

function normalizeDonePayload(payload: any = {}) {
  return {
    answer: `${payload?.answer || ""}`,
    citations: Array.isArray(payload?.citations) ? payload.citations : [],
    toolTrace: Array.isArray(payload?.tool_trace) ? payload.tool_trace : [],
    rounds: Number(payload?.rounds) || 0,
    conversationId: `${payload?.conversation_id || payload?.conversationId || ""}`.trim(),
// Audit C2: when backend history write-back fails, done.persisted=false, top-level prompt "Not saved to history".
    // Legacy backend lacks this field. → Treat as persisted(No false positives)。
    persisted: payload?.persisted !== false,
  };
}

function parseSseEvent(line = "") {
  const trimmed = `${line}`.replace(/\r$/, "");
  if (!trimmed.startsWith("data:")) {
    return null;
  }
  const jsonText = trimmed.slice("data:".length).trim();
  if (!jsonText) {
    return null;
  }
  try {
    return JSON.parse(jsonText);
  } catch (_err) {
    return null;
  }
}

// Consume /ai/ask's SSE body: split by line, data: {json}, tool event callback,
// done Event returns final result,error Event dispatch AiAskError。
export async function readAiAskStream(body, { onToolEvent = null, onAnswerDelta = null } = {}) {
  if (!body || typeof body.getReader !== "function") {
    throw new AiAskError("AI Service response format error,Please retry.");
  }
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;
  let streamedAnswer = "";

  function handleLine(line) {
    const event = parseSseEvent(line);
    if (!event || typeof event !== "object") {
      return;
    }
    if (event.type === "tool") {
      onToolEvent?.(event);
      return;
    }
    if (event.type === "answer_delta") {
// Final answer round step-by-step token delta: accumulate and callback; frontend incremental render based on this.
      const chunk = `${event.text || ""}`;
      if (chunk) {
        streamedAnswer += chunk;
        onAnswerDelta?.(streamedAnswer, chunk);
      }
      return;
    }
    if (event.type === "done") {
      // done.answer For authoritative full text;Backend unresponsive. answer Use accumulated streaming text as fallback.
      result = normalizeDonePayload({
        ...event,
        answer: event.answer || streamedAnswer,
      });
      return;
    }
    if (event.type === "error") {
      throw new AiAskError(`${event.message || "AI Service returned an error."}`);
    }
  }

  try {
    while (!result) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        handleLine(buffer.slice(0, newlineIndex));
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf("\n");
      }
    }
    if (!result) {
      buffer += decoder.decode();
      if (buffer.trim()) {
        handleLine(buffer);
      }
    }
  } finally {
    reader.cancel?.().catch?.(() => {});
    reader.releaseLock?.();
  }
  if (!result) {
throw new AiAskError("AI Service response interrupted, please retry.");
  }
  return result;
}

async function extractErrorMessage(resp) {
  const text = await resp.text().catch(() => "");
  try {
    const envelope = JSON.parse(text);
    // Rust envelope: { code, message }
    const message = `${envelope?.message || ""}`.trim();
    if (message) {
      return message;
    }
    // FastAPI / AI service: { detail: string | [{msg}] }
    const detail = envelope?.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail.trim();
    }
    if (Array.isArray(detail)) {
      const parts = detail
        .map((item) => {
          if (typeof item === "string") {
            return item.trim();
          }
          if (item && typeof item === "object") {
            return `${(item as { msg?: string }).msg || (item as { message?: string }).message || ""}`.trim();
          }
          return "";
        })
        .filter(Boolean);
      if (parts.length) {
        return parts.join("; ");
      }
    }
    return "";
  } catch (_err) {
// Non-JSON: truncate text snippet, avoid full-page HTML blurring chat bubble.
    return `${text || ""}`.replace(/\s+/g, " ").trim().slice(0, 240);
  }
}

// mock pattern's SSE stream:Faithfully replicate the actual backend event sequence.(tool → answer_delta → done)。
// Reference block_id aligns with mock reading area (b-intro-3), enabling end-to-end verification for reference navigation.
function buildMockAskStream(question = "") {
  const encoder = new TextEncoder();
  const answer = [
Regarding 「${question}」, key points retrieved:\\n\\n,
    "- **Halogen-Lithium exchange**Exhibits significant selectivity in conjugated systems [1]\n",
    "- This effect originates from effective conjugation between lithium atoms and aromatic rings. [1]\n\n",
"### Conclusion\n\n",
"Quadruple halogen exchange showed no coordination tendency. Quantum chemical calculations support this explanation. Original HTML like  displayed as text\n",
  ];
  const events = [
    { type: "tool", round: 1, tool: "search_fulltext", arguments: { query: question } },
    { type: "tool", round: 1, tool: "read_blocks", arguments: {} },
    ...answer.map((text) => ({ type: "answer_delta", text })),
    {
      type: "done",
      answer: answer.join(""),
      citations: [
        {
          ref: 1,
          document_id: "doc-9f2a41c8e77b",
          job_id: "mock-job-20260415",
          page_idx: 0,
          block_id: "b-intro-3",
          snippet: "Modern organic synthesis has reached an extremely high level of precision.",
        },
      ],
      tool_trace: [{ round: 1, tool: "search_fulltext" }],
      rounds: 1,
      conversation_id: "mock-conv-reader",
    },
  ];
  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });
}

// Library agentic Q&A: documentId limits to single document on input, skip full DB scan if param missing.
// jobId uploaded together: server-side reverse lookup supported for document and history run, more stable.
// conversationId iterates on input; default server is OK, auto-create and callback in done.conversation_id.
// Returns { answer, citations, toolTrace, rounds, conversationId }; throw on failure with AiAskError.
export async function askLibraryAi({
  question = "",
  documentId = "",
  jobId = "",
  conversationId = "",
/* parent for new user / regenerate time user message id */
  parentId = "",
/* regenerate: only append, assistant sibling branch */
  regenerate = false,
  userMessageId = "",
  assistantMessageId = "",
  onToolEvent = null,
  onAnswerDelta = null,
  signal = null,
  apiPrefix = API_PREFIX,
  fetchImpl = fetch,
  llmApiKey = "",
  llmBaseUrl = "",
  llmModel = "",
} = {}) {
  const trimmed = `${question}`.trim();
  if (!trimmed) {
    throw new AiAskError("Enter question.", 400);
  }
  if (isMockMode()) {
// Faithfully simulate real-world behavior: SSE stream: tool events → answer_delta chunk by chunk → done with reference,
// Let markdown rendering / streaming / all three reference jump paths function; mock reproduces end-to-end.
    return readAiAskStream(buildMockAskStream(trimmed), { onToolEvent, onAnswerDelta });
  }
  const payload: Record<string, any> = { question: trimmed, stream: true };
  const normalizedDocumentId = `${documentId || ""}`.trim();
  const normalizedJobId = `${jobId || ""}`.trim();
  const normalizedConversationId = `${conversationId || ""}`.trim();
  if (normalizedDocumentId) {
    payload.document_id = normalizedDocumentId;
  }
  if (normalizedJobId) {
    payload.job_id = normalizedJobId;
  }
  if (normalizedConversationId) {
    payload.conversation_id = normalizedConversationId;
  }
  const normalizedParentId = `${parentId || ""}`.trim();
  if (normalizedParentId) {
    payload.parent_id = normalizedParentId;
  }
  if (regenerate) {
    payload.regenerate = true;
  }
  const uid = `${userMessageId || ""}`.trim();
  const aid = `${assistantMessageId || ""}`.trim();
  if (uid) payload.user_message_id = uid;
  if (aid) payload.assistant_message_id = aid;
// Carried by request LLM credentials: must be non-empty, disallow empty exports. Authorization: Bearer
  const key = `${llmApiKey || ""}`.trim();
  if (key) {
    // If user mistakenly "Bearer xxx" Paste entire block into settings.,Strip prefix
    payload.llm_api_key = key.replace(/^Bearer\s+/i, "").trim();
  }
  if (`${llmBaseUrl || ""}`.trim()) {
    payload.llm_base_url = `${llmBaseUrl}`.trim();
  }
  if (`${llmModel || ""}`.trim()) {
    payload.llm_model = `${llmModel}`.trim();
  }
  const resp = await fetchImpl(buildApiEndpoint(apiPrefix, "ai/ask"), {
    method: "POST",
    headers: buildApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
    signal,
  });
  if (!resp.ok) {
    if (resp.status === 502) {
throw new AiAskError("AI service not running (502), please start retainpdf-ai service", 502);
    }
    const message = await extractErrorMessage(resp);
    // 401likely service entry X-API-Key（runtime xApiKeyNo translation needed. Source is Chinese, not Vietnamese. Key
    if (resp.status === 401) {
      const hint = /X-API-Key|api key|invalid api key|Unauthorized/i.test(message)
        ? message
: "Service authentication failed: X-API-Key invalid or unconfigured (check runtime-config's xApiKey / backend auth settings).";
      throw new AiAskError(`${hint}(${resp.status})`, 401);
    }
// 400 missing LLM key, explicitly point to 「Settings → Credentials」model API Key
if (resp.status === 400 && /LLM|æ¨¡å\s*API\s*Key|api key/i.test(message)) {
      throw new AiAskError(
message.includes("Credential") || message.includes("Settings")
          ? `${message}(${resp.status})`
          : `Missing model API KeyGo settings → API fill in settings before asking questions.(${resp.status})`,
        400,
      );
    }
    throw new AiAskError(`${message || "AI Q&A request failed,Please try again later."}(${resp.status})`, resp.status);
  }
  const contentType = `${resp.headers?.get?.("content-type") || ""}`.toLowerCase();
  if (contentType.includes("application/json")) {
    // Backend not streaming response.,Support one-time JSON envelope
    return normalizeDonePayload(unwrapEnvelope(await resp.json()));
  }
  return readAiAskStream(resp.body, { onToolEvent, onAnswerDelta });
}
