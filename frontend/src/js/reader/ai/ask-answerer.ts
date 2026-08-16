import { API_PREFIX } from "../../config/api-constants.js";
import { askLibraryAi } from "../../api/ai.js";
import { fetchDocumentByJobId } from "../../api/documents.js";
import {
  hasModelApiKey,
  MISSING_MODEL_API_KEY_MESSAGE,
  resolveReaderAiConfig,
} from "./config.js";
import {
  clearStoredConversationId,
  loadStoredConversationId,
  saveStoredConversationId,
} from "./conversation-store.js";

// Bộ trả lời agentic cho hỏi đáp trình đọc: dùng /api/v1/ai/ask với sự kiện SSE và trích dẫn có thể chuyển tới.
// Tra trực tiếp document_id qua backend GET /documents?job_id= (gồm run lịch sử); không tìm thấy thì fail closed.
// Kết hợp conversation_id lưu cục bộ với auto-create/trả lại trong done của máy chủ để hỗ trợ nhiều lượt.

const QUOTE_MAX_LENGTH = 240;

function clipQuoteText(text = "", maxLength = QUOTE_MAX_LENGTH) {
  const normalized = `${text}`.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trim()}…`;
}

export function buildScopedQuestion({ question = "", scope = "document", context = null, resolveQuote = null } = {}) {
  const trimmed = `${question}`.trim();
  if (!trimmed) {
    return "";
  }
  if (scope === "selection") {
    const quote = typeof resolveQuote === "function" && context ? resolveQuote(context) : null;
    const quoteText = clipQuoteText(quote?.quoteText || "");
    if (quoteText) {
      return `(Dành cho đoạn văn gốc đã chọn: “${quoteText}”) ${trimmed}`;
    }
    if (context?.page) {
      return `(Dành cho nội dung được chọn ở trang ${Number(context.page)}) ${trimmed}`;
    }
  }
  if (scope === "page" && context?.page) {
    return `(Trang hiện tại: ${Number(context.page)}) ${trimmed}`;
  }
  return trimmed;
}

export function createReaderAskAnswerer({
  jobId = "",
  apiPrefix = API_PREFIX,
  ask = askLibraryAi,
  documentByJobId = fetchDocumentByJobId,
  resolveQuote = null,
  // API Key mô hình trong cài đặt xác thực frontend (cùng nguồn với quy trình dịch) được gửi kèm mỗi yêu cầu hỏi đáp tới backend.
  llmConfig = resolveReaderAiConfig,
} = {}) {
  let documentIdPromise = null;
  // Ưu tiên bộ nhớ, localStorage làm dự phòng qua lần tải lại.
  let conversationId = loadStoredConversationId({ jobId });

  function resolveDocumentId() {
    if (!documentIdPromise) {
      documentIdPromise = (async () => {
        try {
          const document = await documentByJobId(apiPrefix, jobId) as { document_id?: string } | null | undefined;
          return `${document?.document_id || ""}`.trim();
        } catch (_err) {
          return "";
        }
      })();
    }
    return documentIdPromise;
  }

  function rememberConversationId(nextId: string, documentId = "") {
    const id = `${nextId || ""}`.trim();
    if (!id) {
      return;
    }
    conversationId = id;
    saveStoredConversationId({ jobId, documentId }, id);
  }

  async function answer({
    question = "",
    scope = "document",
    context = null,
    onToolEvent = null,
    onAnswerDelta = null,
    parentId = "",
    regenerate = false,
    userMessageId = "",
    assistantMessageId = "",
    /** Tín hiệu hủy: dừng SSE; sau aborted không ghi lại liên kết hội thoại để luồng cũ không làm bẩn hội thoại mới. */
    signal = null,
  } = {}) {
    const scopedQuestion = buildScopedQuestion({ context, question, resolveQuote, scope });
    if (!scopedQuestion) {
      throw new Error("Vui lòng nhập câu hỏi.");
    }
    // Cổng xác thực phải chạy trước mọi yêu cầu mạng; nếu không người dùng thấy "Đang tìm kiếm" rồi mới nhận lỗi thiếu Key.
    const config = typeof llmConfig === "function" ? llmConfig() : (llmConfig || {});
    const apiKey = `${config.apiKey || ""}`.trim();
    if (!apiKey) {
      throw new Error(MISSING_MODEL_API_KEY_MESSAGE);
    }
    const documentId = await resolveDocumentId();
    // Hỏi đáp mặc định trên toàn tài liệu: nếu không tra ngược được tài liệu thì fail closed, không âm thầm chuyển sang tìm toàn thư viện.
    if (!documentId && `${jobId || ""}`.trim()) {
      throw new Error("Không thể liên kết tài liệu hiện tại nên chưa thể hỏi đáp trên toàn bộ tài liệu. Hãy xác nhận tác vụ đã gắn với tài liệu rồi thử lại.");
    }
    // Sau khi phân giải document, nếu storage chỉ có job key thì ghi bổ sung một doc key.
    if (!conversationId) {
      conversationId = loadStoredConversationId({ jobId, documentId });
    }
    const result = await ask({
      question: scopedQuestion,
      documentId,
      jobId: `${jobId || ""}`.trim(),
      conversationId,
      parentId: `${parentId || ""}`.trim(),
      regenerate: Boolean(regenerate),
      userMessageId: `${userMessageId || ""}`.trim(),
      assistantMessageId: `${assistantMessageId || ""}`.trim(),
      onToolEvent,
      onAnswerDelta,
      llmApiKey: apiKey,
      llmBaseUrl: `${config.baseUrl || ""}`.trim(),
      llmModel: `${config.model || ""}`.trim(),
      signal,
    });
    const nextConversationId = `${(result as { conversationId?: string })?.conversationId || ""}`.trim();
    // Cấm luồng cũ đã aborted ghi lại liên kết; nếu không khi "chuyển hội thoại trong lúc đang tạo", sự kiện done sẽ
    // kéo conversation_id về hội thoại cũ và câu hỏi sau rơi sai luồng (kiểm toán P0-4).
    if (nextConversationId && !(signal as AbortSignal | null)?.aborted) {
      rememberConversationId(nextConversationId, documentId);
    }
    return {
      ...result,
      conversationId: nextConversationId || conversationId,
      scope,
    };
  }

  return {
    answer,
    getConversationId: () => conversationId,
    setConversationId: (nextId: string, documentId = "") => {
      rememberConversationId(nextId, documentId);
    },
    clearConversationId: (documentId = "") => {
      conversationId = "";
      clearStoredConversationId({ jobId, documentId });
      if (documentId) {
        clearStoredConversationId({ documentId });
      }
      clearStoredConversationId({ jobId });
    },
    getDocumentId: () => resolveDocumentId(),
    ensureLoaded: async () => {
      // Làm nóng document_id; nếu thất bại thì báo lỗi khi answer.
      const documentId = await resolveDocumentId();
      return Boolean(documentId);
    },
  };
}
