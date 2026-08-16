import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { API_PREFIX } from "../config/api-constants.js";
import { unwrapEnvelope } from "../job/core.js";
import { buildApiEndpoint } from "./http.js";

// Hỏi đáp AI cho thư viện (POST /api/v1/ai/ask, luồng SSE).
// Dùng fetch dạng luồng thay vì EventSource vì EventSource không thể gửi header X-API-Key.

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
    // Kiểm toán C2: khi backend không ghi được lịch sử, done.persisted=false và lớp trên báo "chưa lưu vào lịch sử".
    // Backend cũ không có trường này → coi như đã lưu bền vững để tránh báo nhầm.
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

// Đọc SSE body từ /ai/ask: tách `data: {json}` theo dòng, callback cho sự kiện tool,
// sự kiện done trả kết quả cuối, sự kiện error ném AiAskError.
export async function readAiAskStream(body, { onToolEvent = null, onAnswerDelta = null } = {}) {
  if (!body || typeof body.getReader !== "function") {
    throw new AiAskError("Định dạng phản hồi của dịch vụ AI không hợp lệ, vui lòng thử lại.");
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
      // Phần tăng dần theo token của lượt trả lời cuối: tích lũy và gọi callback để frontend kết xuất tăng dần.
      const chunk = `${event.text || ""}`;
      if (chunk) {
        streamedAnswer += chunk;
        onAnswerDelta?.(streamedAnswer, chunk);
      }
      return;
    }
    if (event.type === "done") {
      // done.answer là toàn văn chuẩn; nếu backend không trả answer thì dùng văn bản luồng đã tích lũy làm dự phòng.
      result = normalizeDonePayload({
        ...event,
        answer: event.answer || streamedAnswer,
      });
      return;
    }
    if (event.type === "error") {
      throw new AiAskError(`${event.message || "Dịch vụ AI trả về lỗi."}`);
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
    throw new AiAskError("Phản hồi của dịch vụ AI bị gián đoạn, vui lòng thử lại.");
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
    // Nếu không phải JSON, chỉ lấy một đoạn nội dung thô để tránh đổ cả trang HTML vào bong bóng chat.
    return `${text || ""}`.replace(/\s+/g, " ").trim().slice(0, 240);
  }
}

// Luồng SSE ở chế độ mô phỏng tái hiện đúng chuỗi sự kiện backend thật (tool → answer_delta → done).
// block_id trích dẫn khớp vùng đọc mô phỏng (b-intro-3) để kiểm tra chuyển tới trích dẫn từ đầu đến cuối.
function buildMockAskStream(question = "") {
  const encoder = new TextEncoder();
  const answer = [
    `Đã tìm thấy các ý chính sau về “${question}”:\n\n`,
    "- **Trao đổi halogen-lithium** thể hiện tính chọn lọc đáng kể trong hệ liên hợp [1]\n",
    "- Hiệu ứng này bắt nguồn từ sự liên hợp hiệu quả giữa nguyên tử lithium và vòng thơm [1]\n\n",
    "### Kết luận\n\n",
    "Trao đổi bốn halogen không cho thấy xu hướng phối trí; tính toán hóa lượng tử ủng hộ cách giải thích này. HTML gốc như <img src=x> sẽ hiển thị dưới dạng văn bản.\n",
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
          snippet: "Tổng hợp hữu cơ hiện đại đã đạt độ chính xác rất cao",
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

// Hỏi đáp agentic cho thư viện. Có documentId thì giới hạn một tài liệu; không có thì tìm toàn thư viện.
// Gửi kèm jobId để máy chủ có thể tra ngược document và các run lịch sử ổn định hơn.
// Có conversationId thì dùng hội thoại nhiều lượt; nếu thiếu, máy chủ có thể tự tạo và trả lại trong done.conversation_id.
// Trả về { answer, citations, toolTrace, rounds, conversationId }; khi lỗi thì ném AiAskError.
export async function askLibraryAi({
  question = "",
  documentId = "",
  jobId = "",
  conversationId = "",
  /** parent của user mới / id thông điệp user khi tạo lại */
  parentId = "",
  /** Tạo lại: chỉ nối thêm nhánh assistant cùng cấp */
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
    throw new AiAskError("Vui lòng nhập câu hỏi.", 400);
  }
  if (isMockMode()) {
    // Mô phỏng trung thực luồng SSE thật: sự kiện tool → answer_delta theo khối → done kèm trích dẫn,
    // để ba luồng kết xuất markdown / streaming / chuyển trích dẫn đều tái hiện từ đầu đến cuối trong chế độ mô phỏng.
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
  // Gửi thông tin xác thực LLM theo từng yêu cầu: phải không rỗng, không được gửi Authorization: Bearer rỗng.
  const key = `${llmApiKey || ""}`.trim();
  if (key) {
    // Nếu người dùng dán cả chuỗi "Bearer xxx" vào cài đặt, loại bỏ tiền tố.
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
      throw new AiAskError("Dịch vụ AI chưa chạy (502), vui lòng khởi động dịch vụ retainpdf-ai trước.", 502);
    }
    const message = await extractErrorMessage(resp);
    // 401: thường là X-API-Key ở entry dịch vụ (runtime xApiKey), không phải Key của mô hình.
    if (resp.status === 401) {
      const hint = /X-API-Key|api key|invalid api key|Unauthorized/i.test(message)
        ? message
        : "Xác thực dịch vụ thất bại: X-API-Key không hợp lệ hoặc chưa được cấu hình (kiểm tra xApiKey trong runtime-config / cấu hình auth của backend).";
      throw new AiAskError(`${hint}(${resp.status})`, 401);
    }
    // 400 thiếu LLM key: chỉ rõ API Key của mô hình trong "Cài đặt → Thông tin xác thực".
    if (resp.status === 400 && /LLM|\u6a21\u578b\s*API\s*Key|api key/i.test(message)) {
      throw new AiAskError(
        message.includes("Thông tin xác thực") || message.includes("Cài đặt")
          ? `${message}(${resp.status})`
          : `Thiếu API Key của mô hình: hãy vào Cài đặt → Cài đặt API để nhập khóa trước khi đặt câu hỏi. (${resp.status})`,
        400,
      );
    }
    throw new AiAskError(`${message || "Yêu cầu hỏi đáp AI thất bại, vui lòng thử lại sau."} (${resp.status})`, resp.status);
  }
  const contentType = `${resp.headers?.get?.("content-type") || ""}`.toLowerCase();
  if (contentType.includes("application/json")) {
    // Khi backend không trả dạng luồng, tương thích với JSON envelope trả một lần.
    return normalizeDonePayload(unwrapEnvelope(await resp.json()));
  }
  return readAiAskStream(resp.body, { onToolEvent, onAnswerDelta });
}
