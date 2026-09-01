import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { API_PREFIX } from "../config/api-constants.js";
import { unwrapEnvelope } from "../job/core.js";
import { buildApiEndpoint } from "./http.js";

// Library AI Q&A(POST /api/v1/ai/ask,SSE 流式).
// 用流式 fetch 而不yes EventSource:EventSource Cannot携带 X-API-Key 请求头.

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
    // 审计 C2:后端History回写Failed时 done.persisted=false,上层提示"未存入History".
    // 旧后端None此字段 → 视为已持久化(不误报).
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

// 消费 /ai/ask 的 SSE body:按行切m `data: {json}`,tool Events回调,
// done Events返回最终结果,error Events抛 AiAskError.
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
      // 最终回答轮的逐 token 增量:累积并回调,前端据此增量Rendering
      const chunk = `${event.text || ""}`;
      if (chunk) {
        streamedAnswer += chunk;
        onAnswerDelta?.(streamedAnswer, chunk);
      }
      return;
    }
    if (event.type === "done") {
      // done.answer 为权威全文;后端未回 answer 时用累积的流式文books兜底
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
    // 非 JSON 时截一段Source, 避免整pages HTML 糊到聊天气泡
    return `${text || ""}`.replace(/\s+/g, " ").trim().slice(0, 240);
  }
}

// mock 模式的 SSE 流:忠实复刻真实后端Events序列(tool → answer_delta → done).
// 引用 block_id 对齐 mock 阅读区域(b-intro-3),使引用跳转可端到端验证.
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

// Library agentic 问答.documentId 传入时限定单Documents,不传全Library Search.
// jobId 一并Upload:服务端可反查 document,History run 更稳.
// conversationId 传入时走多轮;缺省服务端可 auto-create 并在 done.conversation_id 回传.
// 返回 { answer, citations, toolTrace, rounds, conversationId };Failed抛 AiAskError.
export async function askLibraryAi({
  question = "",
  documentId = "",
  jobId = "",
  conversationId = "",
  /** 新 user 的 parent / regenerate 时的 user 消息 id */
  parentId = "",
  /** 重新生成:只追加 assistant 兄弟branch */
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
    // 忠实模拟真实 SSE 流:tool Events → answer_delta 逐块 → done 带引用,
    // 让 markdown Rendering / 流式 / 引用跳转三entries链路都能在 mock 下端到端复现.
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
  // 按请求携带 LLM credentials:必须非空,禁止带出空 Authorization: Bearer
  const key = `${llmApiKey || ""}`.trim();
  if (key) {
    // 若用户误把 "Bearer xxx" 整段粘进Settings,剥掉前缀
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
    // 401: 多半yes服务入口 X-API-Key(runtime xApiKey), 不yes模型 Key
    if (resp.status === 401) {
      const hint = /X-API-Key|api key|invalid api key|Unauthorized/i.test(message)
        ? message
        : "Service authentication failed: X-API-Key is invalid or not configured (check runtime-config xApiKey and backend auth settings).";
      throw new AiAskError(`${hint}(${resp.status})`, 401);
    }
    // 400 缺 LLM key: 明确指向"Settings → credentials"的模型 API Key
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
    // 后端未按流式返回时,兼容一次性 JSON envelope
    return normalizeDonePayload(unwrapEnvelope(await resp.json()));
  }
  return readAiAskStream(resp.body, { onToolEvent, onAnswerDelta });
}





