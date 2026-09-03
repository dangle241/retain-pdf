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

// Reader QA agentic responder: uses /api/v1/ai/ask (with SSE progress events and jumpable citations).
// document_id is fetched via backend GET /documents?job_id= (including history runs); fails closed if not found.
// conversation_id has local stickiness + server-side auto-create/done callback for multi-turn support.

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
  // Frontend credentials model API key (same source as TranslationWorkflow), sent with each QA request to backend
  llmConfig = resolveReaderAiConfig,
} = {}) {
  let documentIdPromise = null;
  // Memory first, localStorage fallback (across refreshes)
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
    /** Cancel signal: abort SSE; do not write back session stickiness after abort (prevent old stream polluting new session) */
    signal = null,
  } = {}) {
    const scopedQuestion = buildScopedQuestion({ context, question, resolveQuote, scope });
    if (!scopedQuestion) {
      throw new Error("Enter a question.");
    }
    // Credentials gate must run before any network request; otherwise user sees "Searching..." then missing key error.
    const config = typeof llmConfig === "function" ? llmConfig() : (llmConfig || {});
    const apiKey = `${config.apiKey || ""}`.trim();
    if (!apiKey) {
      throw new Error(MISSING_MODEL_API_KEY_MESSAGE);
    }
    const documentId = await resolveDocumentId();
    // Reader defaults to whole-book QA: fail closed if document not found; do not silently fall back to full Library Search
    if (!documentId && `${jobId || ""}`.trim()) {
      throw new Error("Cannot link current document, cannot do whole-book QA yet. Please confirm the job has a document bound and retry.");
    }
    // After document parsing, if storage only has job key, supplement with doc key
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
    // Aborted old streams must not write back stickiness; otherwise "Generating session switch" would have its
    // conversation_id pulled back to the old session by done events, causing the next question to land on the wrong thread (Audit P0-4)
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
      // Prewarm document_id; report errors only when answering
      const documentId = await resolveDocumentId();
      return Boolean(documentId);
    },
  };
}





