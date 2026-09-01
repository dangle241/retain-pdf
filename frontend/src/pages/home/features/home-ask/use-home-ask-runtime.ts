// Homepage library-level AI Q&A: Full Library / @ Document + Session list (sidebar history)

import { useCallback, useEffect, useRef, useState } from "react";
import { askLibraryAi, AiAskError } from "../../../../js/api/ai.js";
import {
  deleteConversation,
  getConversation,
  listConversations,
  patchConversation,
  type ConversationRecord,
} from "../../../../js/api/conversations.js";
import {
  hasModelApiKey,
  MISSING_MODEL_API_KEY_MESSAGE,
  resolveReaderAiConfig,
} from "../../../../js/reader/ai/config.js";
import { sanitizeAssistantAnswer } from "../../../../js/reader/ai/sanitize-answer.js";
import { resolveCollectionDocuments } from "./document-picker.js";
import type { HomeAskCitation, HomeAskDocScope, HomeAskMessage, HomeAskScope } from "./types.js";

const CONV_STORAGE_KEY = "retainpdf.home.ai.conversation.v1";

export type HomeAskSession = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  documentId?: string;
};

function loadConversationId(): string {
  try {
    return `${globalThis.localStorage?.getItem(CONV_STORAGE_KEY) || ""}`.trim();
  } catch {
    return "";
  }
}

function saveConversationId(id: string) {
  const next = `${id || ""}`.trim();
  try {
    if (!next) {
      globalThis.localStorage?.removeItem(CONV_STORAGE_KEY);
      return;
    }
    globalThis.localStorage?.setItem(CONV_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function describeToolEvent(event: unknown): string {
  const e = event as { tool?: string; name?: string } | null;
  const tool = `${e?.tool || e?.name || ""}`.trim();
if (!tool) return "Retrieving...";
  if (tool.includes("search")) return "Full-text searching…";
  if (tool.includes("read")) return "Reading relevant paragraphs.…";
  if (tool.includes("list")) return "Browsing document library…";
  if (tool.includes("favorite")) return "Viewing favorites…";
  return `Calling... ${tool}…`;
}

function labelScope(s: HomeAskScope): string {
  if (s.kind === "collection") {
    const n = s.document_count != null ? `（${s.document_count} Chapter)` : "";
return `Collection ã${s.title}ã${n}`;
  }
return `Document ã${s.title}ã`;
}

function buildScopedQuestion(
  question: string,
  scopes: HomeAskScope[],
  resolvedDocs: HomeAskDocScope[] = [],
): string {
  const q = `${question || ""}`.trim();
  if (!q) return "";
  if (!scopes.length) return q;

  const hasCollection = scopes.some((s) => s.kind === "collection");
  if (!hasCollection && scopes.length === 1 && scopes[0].kind === "document") {
    return `(scope: document「${scopes[0].title}」）${q}`;
  }

  const scopeLines = scopes.map((s, i) => `${i + 1}. ${labelScope(s)}`).join("\n");
  if (resolvedDocs.length > 0) {
    const docLines = resolvedDocs
      .slice(0, 40)
      .map((d, i) => `  ${i + 1}. ${d.title} (document_id=${d.id})`)
      .join("\n");
const more = resolvedDocs.length > 40 ? `\n  ...total ${resolvedDocs.length} articles` : "";
    return (
      `Search and respond only within the following scope (do not use sources outside it):\n`
      + `Range Selection:\n${scopeLines}\n`
      + `Documents:\n${docLines}${more}\n\n`
+ `Question: ${q}`
    );
  }
return `Please search and answer within the following scope:\n${scopeLines}\n\nQuestion: ${q}`;
}

/** Expand scopes → Doc list; single doc hard scope Return on time. primary */
async function resolveScopesForAsk(scopes: HomeAskScope[]): Promise<{
  primaryDoc: HomeAskDocScope | null;
  resolvedDocs: HomeAskDocScope[];
}> {
  if (!scopes.length) {
    return { primaryDoc: null, resolvedDocs: [] };
  }

  const docs: HomeAskDocScope[] = [];
  const seen = new Set<string>();

  for (const s of scopes) {
    if (s.kind === "document") {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        docs.push(s);
      }
      continue;
    }
    try {
      const list = await resolveCollectionDocuments(s.id, 100);
      for (const d of list) {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          docs.push(d);
        }
      }
    } catch {
      // When collection expansion fails, still rely on prompt Collection name prompt model
    }
  }

  // Single doc (direct or indirect) @ or if the collection has only one)→ Hard limit
  const primaryDoc = docs.length === 1 ? docs[0] : null;
  return { primaryDoc, resolvedDocs: docs };
}

function recordToSession(c: ConversationRecord): HomeAskSession {
const title = `${c.title || ""}`.trim() || "Untitled conversation";
  return {
    id: `${c.conversation_id || ""}`.trim(),
    title,
    updatedAt: `${c.updated_at || c.created_at || ""}`,
    messageCount: Number(c.message_count) || 0,
    documentId: `${c.document_id || ""}`.trim() || undefined,
  };
}

function parseCitations(raw: unknown): HomeAskCitation[] {
  if (Array.isArray(raw)) return raw as HomeAskCitation[];
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function messagesFromDetail(detail: {
  messages?: Array<{
    message_id?: string;
    role?: string;
    content?: string;
    citations_json?: string;
  }>;
}): HomeAskMessage[] {
  const list = Array.isArray(detail?.messages) ? detail.messages : [];
  return list
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({
      id: `${m.message_id || makeId("m")}`,
      role: m.role === "user" ? "user" as const : "assistant" as const,
      content: `${m.content || ""}`,
      citations: parseCitations(m.citations_json),
      status: "complete" as const,
    }));
}

export function useHomeAskRuntime() {
  const [messages, setMessages] = useState<HomeAskMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [conversationId, setConversationId] = useState(loadConversationId);
  const [sessions, setSessions] = useState<HomeAskSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionBusy, setSessionBusy] = useState(false);
  const runningRef = useRef(false);
  const conversationIdRef = useRef(conversationId);
  const abortRef = useRef<AbortController | null>(null);
/** Current streaming assistant message idCleanup on shutdown message */
  const streamingAssistantIdRef = useRef("");
  conversationIdRef.current = conversationId;

  const patchMessage = useCallback((id: string, patch: Partial<HomeAskMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await listConversations({ limit: 80 });
      const list = (res.conversations || [])
        .map(recordToSession)
        .filter((s) => s.id);
      setSessions(list);
    } catch {
      // List failure doesn't block main flow.
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  // If sticky on startup conversationIdTry hydrate(Fail → treat as new conversation)
  useEffect(() => {
    const id = loadConversationId();
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const detail = await getConversation(id);
        if (cancelled) return;
        setConversationId(id);
        conversationIdRef.current = id;
        setMessages(messagesFromDetail(detail));
      } catch {
        if (!cancelled) {
          saveConversationId("");
          setConversationId("");
          conversationIdRef.current = "";
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stop = useCallback(() => {
    const ctrl = abortRef.current;
    if (!ctrl) return;
    try {
      ctrl.abort();
    } catch {
      /* ignore */
    }
  }, []);

  const newSession = useCallback(() => {
    // Abort generation on new chat start.
    if (runningRef.current) {
      try {
        abortRef.current?.abort();
      } catch {
        /* ignore */
      }
    }
    setMessages([]);
    setConversationId("");
    conversationIdRef.current = "";
    saveConversationId("");
  }, []);

  const switchSession = useCallback(async (id: string) => {
    const next = `${id || ""}`.trim();
    if (!next || runningRef.current || sessionBusy) return;
    if (next === conversationIdRef.current && messages.length > 0) return;
    setSessionBusy(true);
    try {
      const detail = await getConversation(next);
      setConversationId(next);
      conversationIdRef.current = next;
      saveConversationId(next);
      setMessages(messagesFromDetail(detail));
    } catch {
      // Cut failure preserves state.
    } finally {
      setSessionBusy(false);
    }
  }, [messages.length, sessionBusy]);

  const removeSession = useCallback(async (id: string) => {
    const next = `${id || ""}`.trim();
    if (!next || runningRef.current || sessionBusy) return;
    setSessionBusy(true);
    try {
      await deleteConversation(next);
      setSessions((prev) => prev.filter((s) => s.id !== next));
      if (conversationIdRef.current === next) {
        setMessages([]);
        setConversationId("");
        conversationIdRef.current = "";
        saveConversationId("");
      }
    } catch {
      /* ignore */
    } finally {
      setSessionBusy(false);
      void refreshSessions();
    }
  }, [refreshSessions, sessionBusy]);

  const renameSession = useCallback(async (id: string, title: string) => {
    const next = `${id || ""}`.trim();
    const nextTitle = `${title || ""}`.trim();
    if (!next || !nextTitle || runningRef.current || sessionBusy) return false;
    setSessionBusy(true);
    try {
      const updated = await patchConversation(next, { title: nextTitle });
      const finalTitle = `${updated?.title || nextTitle}`.trim() || nextTitle;
      setSessions((prev) => prev.map((s) => (
        s.id === next
          ? { ...s, title: finalTitle, updatedAt: `${updated?.updated_at || s.updatedAt}` }
          : s
      )));
      return true;
    } catch {
      return false;
    } finally {
      setSessionBusy(false);
    }
  }, [sessionBusy]);

  const send = useCallback(async (rawQuestion: string, scopes: HomeAskScope[] = []) => {
    const question = `${rawQuestion || ""}`.trim();
    if (!question || runningRef.current) return;

    // No access control. LLM Key Do not initiate any retrieval./Avoid session writes.「Fail fast. Validate inputs first. Don't waste cycles on doomed operations.」
    const config = resolveReaderAiConfig();
    const apiKey = `${config.apiKey || ""}`.trim();
    if (!apiKey) {
      setMessages((prev) => [
        ...prev,
        {
          id: makeId("a"),
          role: "assistant",
          content: MISSING_MODEL_API_KEY_MESSAGE,
          status: "error",
        },
      ]);
      return;
    }

    const userId = makeId("u");
    const assistantId = makeId("a");
    const displayUser = scopes.length
? `${question}\n\n${scopes.map((s) => (s.kind === "collection" ? `@Collection:${s.title}` : `@${s.title}`)).join(" ")}`
      : question;

    // Abort previous round before new request.
    try {
      abortRef.current?.abort();
    } catch {
      /* ignore */
    }
    const abort = new AbortController();
    abortRef.current = abort;
    streamingAssistantIdRef.current = assistantId;

    runningRef.current = true;
    setIsRunning(true);
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: displayUser, status: "complete" },
      {
        id: assistantId,
        role: "assistant",
        content: "",
        progress: scopes.some((s) => s.kind === "collection") ? "Parsing collection…" : "Preparing…",
        status: "streaming",
      },
    ]);

    try {
      const { primaryDoc, resolvedDocs } = await resolveScopesForAsk(scopes);
      if (abort.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (scopes.some((s) => s.kind === "collection") && resolvedDocs.length === 0) {
        const emptyCol = scopes.find((s) => s.kind === "collection");
        patchMessage(assistantId, {
content: `Collection ã${emptyCol?.title || ""}ã there are no documents in the collection yet, please add references to the collection before asking.`,
          progress: "",
          status: "error",
          citations: [],
        });
        return;
      }

      const scopedQuestion = buildScopedQuestion(question, scopes, resolvedDocs);
      let answerStarted = false;
      const result = await askLibraryAi({
        question: scopedQuestion,
        documentId: primaryDoc?.id || "",
        jobId: primaryDoc?.job_id || "",
        conversationId: conversationIdRef.current,
        userMessageId: userId,
        assistantMessageId: assistantId,
        llmApiKey: apiKey,
        llmBaseUrl: config.baseUrl,
        llmModel: config.model,
        signal: abort.signal,
        onToolEvent: (event) => {
          if (abort.signal.aborted || answerStarted) return;
          patchMessage(assistantId, {
            progress: describeToolEvent(event),
            status: "streaming",
          });
        },
        onAnswerDelta: (fullText: string) => {
          if (abort.signal.aborted) return;
          answerStarted = true;
          const cleaned = sanitizeAssistantAnswer(fullText || "", []);
          const show = cleaned.trim() ? cleaned : `${fullText || ""}`;
          patchMessage(assistantId, {
            content: show,
            progress: "",
            status: "streaming",
          });
        },
      });

      if (abort.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const citations = (Array.isArray(result?.citations)
        ? result.citations
        : []) as HomeAskCitation[];
      const answer = sanitizeAssistantAnswer(
        `${result?.answer || ""}`.trim() || "No available answer found.",
        citations,
      );
      const nextConv = `${result?.conversationId || ""}`.trim();
      if (nextConv) {
        setConversationId(nextConv);
        conversationIdRef.current = nextConv;
        saveConversationId(nextConv);
      }
      patchMessage(assistantId, {
        content: answer,
        citations,
        progress: "",
        status: "complete",
      });
      void refreshSessions();
    } catch (error) {
      const aborted = (
        (error instanceof DOMException && error.name === "AbortError")
        || (error instanceof Error && (
          error.name === "AbortError"
          || /abort/i.test(error.message)
        ))
        || abort.signal.aborted
      );
      if (aborted) {
        // Preserve streamed body. Append.「Stopped」
        setMessages((prev) => prev.map((m) => {
          if (m.id !== assistantId) return m;
          const partial = `${m.content || ""}`.trim();
          return {
            ...m,
            content: partial
              ? `${partial}\n\n_(generation stopped)_`
: "_(generation stopped)_",
            progress: "",
            status: "complete" as const,
          };
        }));
      } else {
        const msg = error instanceof AiAskError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to generate answer, please retry.";
        patchMessage(assistantId, {
          content: msg,
          progress: "",
          status: "error",
          citations: [],
        });
      }
    } finally {
      if (abortRef.current === abort) {
        abortRef.current = null;
      }
      streamingAssistantIdRef.current = "";
      runningRef.current = false;
      setIsRunning(false);
    }
  }, [patchMessage, refreshSessions]);

  return {
    messages,
    isRunning,
    conversationId,
    sessions,
    sessionsLoading,
    sessionBusy,
    /** Model configured? KeyGate; read fresh each call. storage） */
    hasLlmKey: hasModelApiKey,
    send,
    stop,
    newSession,
    switchSession,
    removeSession,
    renameSession,
    refreshSessions,
    clearChat: newSession,
  };
}
