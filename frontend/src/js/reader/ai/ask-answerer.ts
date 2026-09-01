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

// Reader问答的 agentic 应答器:走 /api/v1/ai/ask(带 SSE 过程Events与可跳转引用).
// document_id 经后端 GET /documents?job_id= 直查(含History run),查不到时 fail closed.
// conversation_id books地粘性 + 服务端 auto-create / done 回传,实现多轮.

const QUOTE_MAX_LENGTH = 240;

function clipQuoteText(text = "", maxLength = QUOTE_MAX_LENGTH) {
  const normalized = `${text}`.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trim()}...`;
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
      return `(For the selected source snippet: "${quoteText}")${trimmed}`;
    }
    if (context?.page) {
      return `(ForPage ${Number(context.page)} pagesselection content)${trimmed}`;
    }
  }
  if (scope === "page" && context?.page) {
    return `(CurrentPage ${Number(context.page)} pages)${trimmed}`;
  }
  return trimmed;
}

export function createReaderAskAnswerer({
  jobId = "",
  apiPrefix = API_PREFIX,
  ask = askLibraryAi,
  documentByJobId = fetchDocumentByJobId,
  resolveQuote = null,
  // 前端credentialsSettings里的模型 API Key(与TranslationWorkflow同源),按请求随问答一起传给后端
  llmConfig = resolveReaderAiConfig,
} = {}) {
  let documentIdPromise = null;
  // 内存优先,localStorage 兜底(跨刷新)
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
    /** Cancel信号: 中止 SSE；aborted 后不回写会话粘性(防旧流污染新会话) */
    signal = null,
  } = {}) {
    const scopedQuestion = buildScopedQuestion({ context, question, resolveQuote, scope });
    if (!scopedQuestion) {
      throw new Error("Enter a question.");
    }
    // credentials门禁必须在任何网络请求之前: no则用户会先看到"Search中"再报缺 Key
    const config = typeof llmConfig === "function" ? llmConfig() : (llmConfig || {});
    const apiKey = `${config.apiKey || ""}`.trim();
    if (!apiKey) {
      throw new Error(MISSING_MODEL_API_KEY_MESSAGE);
    }
    const documentId = await resolveDocumentId();
    // Reader默认整books问答:反查不到Documents时 fail closed,禁止静默变全Library Search
    if (!documentId && `${jobId || ""}`.trim()) {
      throw new Error("Cannot关联CurrentDocuments, 暂不能做整books问答.请确认任务已绑定Documents后Retry.");
    }
    // document parse后若 storage 里只有 job key,再补写一份 doc key
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
    // aborted 的旧流禁止回写粘性: no则"Generating切会话"会被 done Events把
    // conversation_id 拽回旧会话, 下一问落错线程(审计 P0-4)
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
      // Prewarm document_id;Failed在 answer 时再报错
      const documentId = await resolveDocumentId();
      return Boolean(documentId);
    },
  };
}





