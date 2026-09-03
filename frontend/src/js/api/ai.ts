import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { API_PREFIX } from "../config/api-constants.js";
import { unwrapEnvelope } from "../job/core.js";
import { buildApiEndpoint } from "./http.js";

// Library AI Q&A (POST /api/v1/ai/ask, SSE streaming).
// Use streaming fetch instead of EventSource: EventSource cannot carry X-API-Key header.

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
    // Audit C2: done.persisted=false when backend history write fails; UI shows "not saved to history".
    // Old backend lacks this field → treat as persisted (no false alarm).
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

// Consume /ai/ask SSE body: split by line into `data: {json}`, tool events via callback,
// done event returns final result, error event throws AiAskError.
export async function readAiAskStream(body, { onToolEvent = null, onAnswerDelta = null } = {}) {
  if (!body || typeof body.getReader !== "function") {
    throw new AiAskError("AI service returned an invalid response. Please retry.");
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
      // Per-token delta of final answer turn: accumulate and callback; frontend renders incrementally
      const chunk = `${event.text || ""}`;
      if (chunk) {
        streamedAnswer += chunk;
        onAnswerDelta?.(streamedAnswer, chunk);
      }
      return;
    }
    if (event.type === "done") {
      // done.answer is authoritative full text; fall back to accumulated stream text if backend omitted answer
      result = normalizeDonePayload({
        ...event,
        answer: event.answer || streamedAnswer,
      });
      return;
    }
    if (event.type === "error") {
      throw new AiAskError(`${event.message || "AI service returned an error."}`);
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
    throw new AiAskError("AI service response was interrupted. Please retry.");
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
    // Non-JSON: clip a source snippet so a full HTML page does not flood the chat bubble
    return `${text || ""}`.replace(/\s+/g, " ").trim().slice(0, 240);
  }
}

// Mock-mode SSE stream: faithfully replay real backend event sequence (tool → answer_delta → done).
// Citation block_id matches mock reader region (b-intro-3) so citation jump can be verified end-to-end.
function buildMockAskStream(question = "") {
  const encoder = new TextEncoder();
  const answer = [
    `About"${question}",the following points were found:\n\n`,
    "- **halogen-lithium exchange**shows significant selectivity in conjugated systems [1]\n",
    "- this effect comes from effective conjugation between lithium atoms and the aromatic ring [1]\n\n",
    "### Conclusion\n\n",
    "Quadruple halogen exchange did not show coordination preference, and quantum chemistry calculations support this explanation. Raw HTML such as <img src=x> is displayed as text.\n",
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
          snippet: "Modern organic synthesis has reached a very high level of precision",
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

// Library agentic Q&A. documentId scopes to one document; omit it for full library search.
// jobId is sent too so the server can reverse-lookup the document (history runs more stable).
// conversationId enables multi-turn; if omitted, server may auto-create and return done.conversation_id.
// Returns { answer, citations, toolTrace, rounds, conversationId }; throws AiAskError on failure.
export async function askLibraryAi({
  question = "",
  documentId = "",
  jobId = "",
  conversationId = "",
  /** Parent of a new user message / user message id when regenerating */
  parentId = "",
  /** Regenerate: only append a sibling assistant branch */
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
    throw new AiAskError("Enter a question.", 400);
  }
  if (isMockMode()) {
    // Faithfully simulate real SSE stream: tool events → answer_delta chunks → done with citations,
    // so markdown render / streaming / citation-jump can all be reproduced end-to-end under mock.
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
  // Attach LLM credentials per request: must be non-empty; never send empty Authorization: Bearer
  const key = `${llmApiKey || ""}`.trim();
  if (key) {
    // If the user pasted "Bearer xxx" into Settings, strip the prefix
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
      throw new AiAskError("AI service is not running (502). Start the retainpdf-ai service first.", 502);
    }
    const message = await extractErrorMessage(resp);
    // 401: usually the service-entry X-API-Key (runtime xApiKey), not the model key
    if (resp.status === 401) {
      const hint = /X-API-Key|api key|invalid api key|Unauthorized/i.test(message)
        ? message
        : "Service authentication failed: X-API-Key is invalid or not configured (check runtime-config xApiKey and backend auth settings).";
      throw new AiAskError(`${hint}(${resp.status})`, 401);
    }
    // 400 missing LLM key: point at the model API key in "Settings → credentials"
    // Regex keeps "LLM" / "model API Key" to match backend error text (compat).
    if (resp.status === 400 && /LLM|模型\s*API\s*Key|api key/i.test(message)) {
      throw new AiAskError(
        message.includes("credentials") || message.includes("Settings")
          ? `${message}(${resp.status})`
          : `Missing model API key: enter it in Settings -> API Settings before asking.(${resp.status})`,
        400,
      );
    }
    throw new AiAskError(`${message || "AI Q&A request failed. Please retry later."}(${resp.status})`, resp.status);
  }
  const contentType = `${resp.headers?.get?.("content-type") || ""}`.toLowerCase();
  if (contentType.includes("application/json")) {
    // Backend did not stream: accept a one-shot JSON envelope
    return normalizeDonePayload(unwrapEnvelope(await resp.json()));
  }
  return readAiAskStream(resp.body, { onToolEvent, onAnswerDelta });
}





