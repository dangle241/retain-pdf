// assistant-ui ExternalStoreProgress/Separate body content. + Message branch tree + Local snapshot.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ExportedMessageRepository,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import { describeToolEvent } from "../../../legacy/ai/answer-view.js";
import {
  armReaderAiClickShield,
  clearThreadBranchSnapshot,
  createReaderAskAnswerer,
  createReaderMarkdownAnswerer,
  defaultReaderDataPort,
  deleteConversation,
  forkConversationFromPath,
  getConversation,
  listConversations,
  loadStoredConversationId,
  loadThreadBranchSnapshot,
  lockReaderAiNavigation,
  messagesToBranchItems,
  nextForkConversationTitle,
  patchConversation,
  sanitizeAssistantAnswer,
  saveThreadBranchSnapshot,
  type AiCitationLike,
  type ConversationRecord,
  type ThreadBranchItem,
  type ThreadBranchMessage,
  type ThreadBranchSnapshot,
} from "../../../external.js";

export type ReaderAskStoreMessage = ThreadBranchMessage & {
  citations?: AiCitationLike[];
  status?: ThreadMessageLike["status"];
};

type TreeItem = {
  parentId: string | null;
  message: ReaderAskStoreMessage;
};

const SUGGESTIONS = [
  { prompt: "这篇文献的主要结论是什么？" },
  { prompt: "作者用了什么方法或模型？" },
  { prompt: "有哪些关键结果或数据？" },
];

function textFromAppend(message: AppendMessage): string {
  const content = message.content as unknown;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (part && typeof part === "object" && (part as { type?: string }).type === "text") {
        return `${(part as { text?: string }).text || ""}`;
      }
      return "";
    })
    .join("")
    .trim();
}

function toThreadMessageLike(message: ReaderAskStoreMessage): ThreadMessageLike {
  // Note:fromThreadMessageLike Will be lost trim Empty text part；
  // Use visible dots for streaming placeholders to avoid content=[] Tooltip fails to mount. Parts。
  const raw = message.content;
  const isAssistant = message.role === "assistant";
  const content = raw.trim()
    ? raw
    : isAssistant && message.status?.type === "running"
      ? "…"
      : raw;
  // assistant-ui fromBranchableArray：status Appears only in assistant, otherwise
  // Uncaught Error: status is only supported for assistant messages
  return {
    id: message.id,
    role: message.role,
    content: [{ type: "text", text: content || "" }],
    ...(isAssistant && message.status ? { status: message.status } : {}),
    metadata: {
      custom: {
        citations: message.citations || [],
        progress: message.progress || "",
        storeId: message.id,
      },
    },
  };
}

function shouldFallbackToLocal(error: unknown): boolean {
  const status = Number((error as { status?: number })?.status) || 0;
  const msg = `${(error as Error)?.message || ""}`;
  return status === 502 || /\b502\b/.test(msg);
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCitations(raw: unknown): AiCitationLike[] {
  if (!Array.isArray(raw)) return [];
  const out: AiCitationLike[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const c = item as AiCitationLike;
    const blockId = `${c.block_id || ""}`.trim();
    if (!blockId) continue;
    let pageIdx: number | undefined;
    const rawPage = c.page_idx ?? c.page;
    if (rawPage !== undefined && rawPage !== null && `${rawPage}`.trim() !== "") {
      const n = Number(rawPage);
      if (Number.isFinite(n) && n >= 0) pageIdx = Math.floor(n);
    }
    if (pageIdx === undefined) {
      const m = blockId.match(/(?:^|[^0-9])p0*([1-9]\d*)(?:-|_|\b)/i);
      if (m) pageIdx = Math.max(0, Number(m[1]) - 1);
    }
    out.push({
      ...c,
      block_id: blockId,
      ref: c.ref,
      page_idx: pageIdx,
      job_id: `${c.job_id || ""}`.trim(),
      document_id: `${c.document_id || ""}`.trim(),
      snippet: `${c.snippet || ""}`.trim(),
    });
  }
  return out;
}

function snapshotFromTree(
  items: readonly TreeItem[],
  headId: string | null,
): ThreadBranchSnapshot {
  return {
    version: 1,
    headId,
    items: items.map((item) => ({
      parentId: item.parentId,
      message: {
        id: item.message.id,
        role: item.message.role,
        content: item.message.content,
        ...(item.message.progress ? { progress: item.message.progress } : {}),
        ...(item.message.citations?.length
          ? { citations: item.message.citations }
          : {}),
        ...(item.message.status
          ? {
            status: {
              type: item.message.status.type,
              ...("reason" in item.message.status && item.message.status.reason
                ? { reason: `${item.message.status.reason}` }
                : {}),
            },
          }
          : {}),
      },
    })) as ThreadBranchItem[],
  };
}

function treeFromSnapshot(snapshot: ThreadBranchSnapshot): {
  items: TreeItem[];
  headId: string | null;
} {
  const items: TreeItem[] = snapshot.items.map((item) => ({
    parentId: item.parentId,
    message: {
      ...item.message,
      citations: (item.message.citations || []) as AiCitationLike[],
      status: item.message.status as ReaderAskStoreMessage["status"],
    },
  }));
  return { items, headId: snapshot.headId };
}

function visibleMessages(
  items: readonly TreeItem[],
  headId: string | null,
): ReaderAskStoreMessage[] {
  if (!items.length) return [];
  const byId = new Map(items.map((i) => [i.message.id, i]));
  const head = (headId && byId.get(headId)) || items[items.length - 1];
  if (!head) return [];
  const chain: ReaderAskStoreMessage[] = [];
  let cur: TreeItem | undefined = head;
  const guard = new Set<string>();
  while (cur && !guard.has(cur.message.id)) {
    guard.add(cur.message.id);
    chain.push(cur.message);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain.reverse();
}

function findMessage(
  items: readonly TreeItem[],
  id: string | null | undefined,
): ReaderAskStoreMessage | null {
  if (!id) return null;
  return items.find((i) => i.message.id === id)?.message ?? null;
}

/** Along any message edge parent Backtrack to root, get nodes on path. TreeItem Sequence (root→Leaf). */
function pathItemsToMessage(
  items: readonly TreeItem[],
  targetId: string,
): TreeItem[] {
  const byId = new Map(items.map((i) => [i.message.id, i]));
  let cur = byId.get(targetId);
  if (!cur) return [];
  const chain: TreeItem[] = [];
  const guard = new Set<string>();
  while (cur && !guard.has(cur.message.id)) {
    guard.add(cur.message.id);
    chain.push(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain.reverse();
}

/**
* Use path for branch: priority parent chain; if chain broken/missing parent, degrade to "Truncate visible path to target answer".
 * Avoid only fork Truncated (even single item) assistantresulting in「Branch ≠ new chat./No context」。
 */
function pathForBranch(
  items: readonly TreeItem[],
  targetId: string,
  headId: string | null,
): TreeItem[] {
  const tid = `${targetId || ""}`.trim();
  if (!tid || !items.length) return [];

// aui sometimes uses own id; prioritize exact match, fallback to current head / most recent assistant
  let resolvedId = tid;
  if (!items.some((i) => i.message.id === resolvedId)) {
    if (headId && items.some((i) => i.message.id === headId)) {
      resolvedId = headId;
    } else {
      const lastAssist = [...items].reverse().find((i) => i.message.role === "assistant");
      if (lastAssist) resolvedId = lastAssist.message.id;
    }
  }

  let path = pathItemsToMessage(items, resolvedId);
  // parent Chain complete: contains at least user+assistant
  if (path.length >= 2 && path[path.length - 1].message.role === "assistant") {
    return path;
  }
  if (path.length === 1 && path[0].message.role === "user") {
    path = [];
  }

  // FallbackFallback: slice from root to target (inclusive) based on current visible linear order. targetincl.
  const visible = visibleMessages(items, headId || resolvedId);
  let idx = visible.findIndex((m) => m.id === resolvedId);
  if (idx < 0) {
    // Back again: entire visible path (starting with head For Ye)
    idx = visible.length - 1;
  }
  if (idx < 0) return path;
  const byId = new Map(items.map((i) => [i.message.id, i]));
  const linear: TreeItem[] = [];
  for (let i = 0; i <= idx; i += 1) {
    const row = byId.get(visible[i].id);
    if (row) linear.push(row);
  }
  // Ensure that assistant End
  while (linear.length && linear[linear.length - 1].message.role !== "assistant") {
    linear.pop();
  }
  return linear.length ? linear : path;
}

function treeItemsFromBranchItems(
  branchItems: ReturnType<typeof messagesToBranchItems>,
): TreeItem[] {
  return branchItems.map((item) => ({
    parentId: item.parentId,
    message: {
      ...item.message,
      citations: (item.message.citations || []) as AiCitationLike[],
      status: item.message.status as ReaderAskStoreMessage["status"],
    },
  }));
}

export type ReaderAskSessionSummary = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  active: boolean;
};

export function useReaderAskRuntime(options: {
  jobId: string;
  enabled: boolean;
}) {
  const { jobId, enabled } = options;
  const [items, setItems] = useState<TreeItem[]>([]);
  const [headId, setHeadId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [sessions, setSessions] = useState<ConversationRecord[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const runningRef = useRef(false);
// Throughout a single run: Assistant cancel handle: onCancel/switch session/new session/before rapid-fire abort.
// Audit P0-2/3/4 Root cause: previously absent. â Stop continuous streaming, complete stream resurrection cancelled
  // Messages, legacy stream write-back session affinity rely solely on this. controller Clear.
  const runAbortRef = useRef<AbortController | null>(null);
  const itemsRef = useRef(items);
  const headIdRef = useRef(headId);
  const activeConversationIdRef = useRef(activeConversationId);
  const streamRafRef = useRef<number | null>(null);
  const pendingContentRef = useRef("");
  const streamAssistantIdRef = useRef("");
  /** Streaming body bypass (does not depend on aui Parts / status), ensuring token Refresh on Arrival */
  const streamContentRef = useRef<Record<string, string>>({});
  const [streamEpoch, setStreamEpoch] = useState(0);
  const [streamingAssistantId, setStreamingAssistantId] = useState("");
  const answerStartedRef = useRef(false);
  const persistReadyRef = useRef(false);
  const lastJobRef = useRef("");
  const documentIdRef = useRef("");
  const switchTokenRef = useRef(0);

  itemsRef.current = items;
  headIdRef.current = headId;
  activeConversationIdRef.current = activeConversationId;

  const remoteAnswerer = useMemo(() => {
    if (!enabled || !jobId) return null;
    return createReaderAskAnswerer({ jobId });
  }, [enabled, jobId]);

  const refreshSessions = useCallback(async (documentId = "") => {
    const doc = `${documentId || documentIdRef.current || ""}`.trim();
    if (!doc) {
      setSessions([]);
      return;
    }
    try {
      const res = await listConversations({ document_id: doc, limit: 50 });
      setSessions(res.conversations || []);
    } catch {
// List failure does not block main flow
    }
  }, []);

  const applyConversationTree = useCallback((
    branchItems: ReturnType<typeof messagesToBranchItems>,
    head?: string | null,
  ) => {
    const tree = treeItemsFromBranchItems(branchItems);
    setItems(tree);
    setHeadId(
      `${head || ""}`.trim()
      || tree[tree.length - 1]?.message.id
      || null,
    );
  }, []);

// Job switch / Panel open: fetch session list + hydrate message tree
// Note: Panel closing enabled=false runs too effect; cannot use lastJobRef when enabled flips directly. return,
// Otherwise "Open panel" never refreshes sessions (user sees list only after starting new conversation).
  useEffect(() => {
    if (!jobId) {
      setItems([]);
      setHeadId(null);
      setSessions([]);
      setActiveConversationId("");
      activeConversationIdRef.current = "";
      lastJobRef.current = "";
      documentIdRef.current = "";
      persistReadyRef.current = false;
      return;
    }

    const jobChanged = lastJobRef.current !== jobId;
    if (jobChanged) {
      lastJobRef.current = jobId;
      persistReadyRef.current = false;
      runningRef.current = false;
      setIsRunning(false);
      setItems([]);
      setHeadId(null);
      setSessions([]);
      setActiveConversationId("");
      activeConversationIdRef.current = "";
      documentIdRef.current = "";
    }

    // Panel not open: log only jobwait for enabled Pull net again
    if (!enabled || !remoteAnswerer) return;

    let cancelled = false;
    void (async () => {
// 1) Parse document_id (list filtered by document)
      let docId = `${documentIdRef.current || ""}`.trim();
      if (!docId) {
        try {
          docId = `${(await remoteAnswerer.getDocumentId?.()) || ""}`.trim();
        } catch {
          docId = "";
        }
        if (docId) documentIdRef.current = docId;
      }

      // 2) Always refresh session list (open panel / switch job all need)
      if (!cancelled && docId) {
        await refreshSessions(docId);
      }

      // 3) Message tree:job Retry after switch or if tree is empty. hydrate
      const needHydrate = jobChanged || !itemsRef.current.length;
      if (!needHydrate || cancelled) {
        if (!cancelled) persistReadyRef.current = true;
        return;
      }

      const convId =
        loadStoredConversationId({ jobId, documentId: docId })
        || `${remoteAnswerer.getConversationId?.() || ""}`.trim();

      if (convId) {
        setActiveConversationId(convId);
        activeConversationIdRef.current = convId;
        remoteAnswerer.setConversationId?.(convId, docId);
        try {
          const detail = await getConversation(convId);
          if (cancelled) return;
          const branchItems = messagesToBranchItems(detail.messages || []);
          if (branchItems.length) {
            applyConversationTree(branchItems, detail.head_id);
            requestAnimationFrame(() => {
              if (!cancelled) persistReadyRef.current = true;
            });
            return;
          }
        } catch {
          // Network/404 → Local snapshot
        }
      }

      // Sticky sessions: if list has chats, auto-select latest for quick switch.
      if (!cancelled && docId) {
        try {
          const listed = await listConversations({ document_id: docId, limit: 50 });
          if (cancelled) return;
          const rows = listed.conversations || [];
          setSessions(rows);
          const latest = rows[0];
          if (latest?.conversation_id) {
            const latestId = latest.conversation_id;
            setActiveConversationId(latestId);
            activeConversationIdRef.current = latestId;
            remoteAnswerer.setConversationId?.(latestId, docId);
            try {
              const detail = await getConversation(latestId);
              if (cancelled) return;
              applyConversationTree(
                messagesToBranchItems(detail.messages || []),
                detail.head_id,
              );
              requestAnimationFrame(() => {
                if (!cancelled) persistReadyRef.current = true;
              });
              return;
            } catch {
              // fall through to snapshot
            }
          }
        } catch {
          // ignore list failure
        }
      }

      if (cancelled) return;
      const saved = loadThreadBranchSnapshot(jobId, convId);
      if (saved?.items.length) {
        const tree = treeFromSnapshot(saved);
        setItems(tree.items);
        setHeadId(tree.headId);
      } else {
        setItems([]);
        setHeadId(null);
      }
      requestAnimationFrame(() => {
        if (!cancelled) persistReadyRef.current = true;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId, enabled, remoteAnswerer, refreshSessions, applyConversationTree]);

  // Debounce persist full tree (per-session isolation).
  useEffect(() => {
    if (!jobId || !persistReadyRef.current) return;
    const convId = activeConversationId;
    const timer = window.setTimeout(() => {
      if (!items.length) {
        clearThreadBranchSnapshot(jobId, convId);
        return;
      }
      saveThreadBranchSnapshot(jobId, snapshotFromTree(items, headId), convId);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [jobId, items, headId, activeConversationId]);

  const localAnswerer = useMemo(() => {
    if (!enabled || !jobId) return null;
    return createReaderMarkdownAnswerer({
      loadMarkdownPayload: defaultReaderDataPort.loadMarkdownPayload,
    });
  }, [enabled, jobId]);

  const messages = useMemo(
    () => visibleMessages(items, headId),
    [items, headId],
  );

  const citationsByMessageId = useMemo(() => {
    const map: Record<string, AiCitationLike[]> = {};
    for (const item of items) {
      const m = item.message;
      if (m.role === "assistant" && m.citations?.length) {
        map[m.id] = m.citations as AiCitationLike[];
      }
    }
    return map;
  }, [items]);

  const progressByMessageId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of items) {
      const m = item.message;
      if (m.role === "assistant" && m.progress) {
        map[m.id] = m.progress;
      }
    }
    return map;
  }, [items]);

  /** Stream body bypass:store + In progress streamContent（streamEpoch Force refresh */
  const contentByMessageId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of items) {
      const m = item.message;
      if (m.content) map[m.id] = m.content;
    }
    // Override with latest streaming buffer (may be more than half a frame than items) items Most frames
    for (const [id, text] of Object.entries(streamContentRef.current)) {
      if (text) map[id] = text;
    }
    void streamEpoch;
    return map;
  }, [items, streamEpoch]);

  const messageRepository = useMemo(
    () =>
      ExportedMessageRepository.fromBranchableArray(
        items.map((item) => ({
          message: toThreadMessageLike(item.message),
          parentId: item.parentId,
        })),
        { headId },
      ),
    [items, headId],
  );

  const patchAssistant = useCallback((
    assistantId: string,
    patch: Partial<ReaderAskStoreMessage>,
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.message.id === assistantId
          ? { ...item, message: { ...item.message, ...patch } }
          : item,
      ),
    );
  }, []);

// Stream cleaning downsample: sanitize from "per token" to "once per frame" (rAF flush within),
  // Long answers: no more re-running over full text. 5 Audit regex. P1-7 O(n²)）。
  // Semantics unchanged: fallback to original text if cleaned result is empty to ensure visible increments.
  const sanitizeStreamText = useCallback((raw: string) => {
    const cleaned = sanitizeAssistantAnswer(raw || "", []);
    return cleaned.trim() ? cleaned : `${raw || ""}`;
  }, []);

  const scheduleAnswerText = useCallback((assistantId: string, text: string) => {
    const next = `${text || ""}`;
    pendingContentRef.current = next;
    answerStartedRef.current = true;
    streamAssistantIdRef.current = assistantId;

    // first chunk: sync to screen (bypass + store), to avoid waiting for rAF / aui status
    const cur = itemsRef.current.find((i) => i.message.id === assistantId);
    if (!cur?.message.content?.trim()) {
      if (streamRafRef.current != null) {
        cancelAnimationFrame(streamRafRef.current);
        streamRafRef.current = null;
      }
      const shown = sanitizeStreamText(next);
      streamContentRef.current[assistantId] = shown;
      setStreamEpoch((n) => n + 1);
      patchAssistant(assistantId, {
        content: shown,
        progress: "",
        status: { type: "running" },
      });
      return;
    }

    // Max per frame. flush Single bypass;store Update to prevent message truncation.
    if (streamRafRef.current != null) return;
    streamRafRef.current = requestAnimationFrame(() => {
      streamRafRef.current = null;
      // Stale guard: cancel/after rapid-fire pendingContentRef Belongs to new stream,
// Old rAF: do not write into old bubble (audit). P0-3 Stream)
      if (streamAssistantIdRef.current !== assistantId) return;
      const latest = sanitizeStreamText(pendingContentRef.current);
      streamContentRef.current[assistantId] = latest;
      setStreamEpoch((n) => n + 1);
      patchAssistant(assistantId, {
        content: latest,
        progress: "",
        status: { type: "running" },
      });
    });
  }, [patchAssistant, sanitizeStreamText]);

  // Uninstall (close floating window/Abort in-flight requests on page leave. Prevent ghost requests. SSE
  useEffect(() => () => {
    runAbortRef.current?.abort();
    runAbortRef.current = null;
  }, []);

  const runAssistant = useCallback(async (
    assistantId: string,
    question: string,
    opts: {
      parentId?: string | null;
      userMessageId?: string;
      regenerate?: boolean;
    } = {},
  ) => {
    if (!remoteAnswerer && !localAnswerer) {
      patchAssistant(assistantId, {
        content: "Q&A temporarily unavailable: confirm task reader open.",
        progress: "",
        status: { type: "incomplete", reason: "error" },
      });
      return;
    }

    // Abort in-flight request before starting new one. controller
    runAbortRef.current?.abort();
    const controller = new AbortController();
    runAbortRef.current = controller;

    runningRef.current = true;
    answerStartedRef.current = false;
    pendingContentRef.current = "";
    streamAssistantIdRef.current = assistantId;
    streamContentRef.current[assistantId] = "";
    setStreamingAssistantId(assistantId);
    setStreamEpoch((n) => n + 1);
    setIsRunning(true);
// Placeholder running: ensure UI uses streaming path
    patchAssistant(assistantId, {
      content: "",
      progress: "Retrieving documents…",
      status: { type: "running" },
    });

    try {
      await remoteAnswerer?.ensureLoaded?.(jobId);
      let usedFallback = false;
      let result: { answer?: string; citations?: unknown[] };
      try {
        result = await remoteAnswerer!.answer({
          question,
          scope: "document",
          parentId: opts.parentId || "",
          regenerate: Boolean(opts.regenerate),
          userMessageId: opts.userMessageId || "",
          assistantMessageId: assistantId,
          onToolEvent: (event) => {
            const line = describeToolEvent(event);
            if (!line || answerStartedRef.current) return;
            patchAssistant(assistantId, {
              progress: line,
              status: { type: "running" },
            });
          },
          onAnswerDelta: (fullText: string) => {
            if (controller.signal.aborted) return;
            // Original enqueued directly; cleaning at... scheduleAnswerText frame-level of flush do inside
// (Full-text sanitize per token is O(nÂ²), Audit P1-7) token full text sanitize is O(nÂ²) Audit log missing. Add `auditLog.info('Action performed', { userId, action })` before state change. skipped: detailed audit fields, add when compliance requires. P1-7)
            if (fullText) scheduleAnswerText(assistantId, fullText);
          },
          signal: controller.signal,
        });
      } catch (error) {
        // Manual cancel: no downgrade, no error; bubble state already onCancel Freeze
        if (controller.signal.aborted) return;
        if (!localAnswerer || !shouldFallbackToLocal(error)) throw error;
        usedFallback = true;
        if (!answerStartedRef.current) {
          patchAssistant(assistantId, {
            progress: "Online service temporarily unavailable, using local search.…",
            status: { type: "running" },
          });
        }
        await localAnswerer.ensureLoaded?.(jobId);
        result = await localAnswerer.answer({ question, scope: "document" });
      }

// Final gate: canceled runs must not overwrite with full answer. "Cancelled" tooltip
      if (controller.signal.aborted) return;
      if (streamRafRef.current != null) {
        cancelAnimationFrame(streamRafRef.current);
        streamRafRef.current = null;
      }
      const citations = normalizeCitations(result?.citations);
      let answer = sanitizeAssistantAnswer(
`${result?.answer || pendingContentRef.current || ""}`.trim() || "No available answer found.",
        citations,
      );
      if (usedFallback) {
        answer = `${answer}\n\n_Online service temporarily unavailable. Above from local document retrieval._`;
      }
      if ((result as { persisted?: boolean })?.persisted === false) {
// Audit C2: Write-back failures no longer silent â user must know to copy and save.
        answer = `${answer}\n\n_⚠️ Unable to save this response to history (storage temporarily unavailable). It may be lost on refresh._`;
      }
      delete streamContentRef.current[assistantId];
      streamAssistantIdRef.current = "";
      setStreamingAssistantId("");
      setStreamEpoch((n) => n + 1);
      patchAssistant(assistantId, {
        content: answer,
        progress: "",
        citations,
        status: { type: "complete", reason: "stop" },
      });
    } catch (error) {
// Throw on manual cancellation. AbortError is not a failure; bubble already frozen onCancel
      if (controller.signal.aborted) return;
      if (streamRafRef.current != null) {
        cancelAnimationFrame(streamRafRef.current);
        streamRafRef.current = null;
      }
      delete streamContentRef.current[assistantId];
      streamAssistantIdRef.current = "";
      setStreamingAssistantId("");
      setStreamEpoch((n) => n + 1);
const msg = error instanceof Error ? error.message : "Failed to generate answer, please try again.";
      patchAssistant(assistantId, {
        content: msg,
        progress: "",
        citations: [],
        status: { type: "incomplete", reason: "error" },
      });
    } finally {
// Only "Still running" resets global flag: finally of old run must not step on new run
      if (runAbortRef.current === controller) {
        runAbortRef.current = null;
        runningRef.current = false;
        setIsRunning(false);
      }
    }
  }, [jobId, localAnswerer, patchAssistant, remoteAnswerer, scheduleAnswerText]);

  const onNew = useCallback(async (message: AppendMessage) => {
    if (runningRef.current) return;
    const question = textFromAppend(message);
    if (!question) return;

// Prioritize append built-in parentId from a certain answer; when branching, parent = that assistant id
    const parentId = message.parentId ?? headIdRef.current;
    const userId = makeId("u");
    const assistantId = makeId("a");

    setItems((prev) => [
      ...prev,
      { parentId, message: { id: userId, role: "user", content: question } },
      {
        parentId: userId,
        message: {
          id: assistantId,
          role: "assistant",
          content: "",
progress: "Retrieving document...",
          status: { type: "running" },
          citations: [],
        },
      },
    ]);
    setHeadId(assistantId);
    await runAssistant(assistantId, question, {
      parentId,
      userMessageId: userId,
      regenerate: false,
    });
  }, [runAssistant]);

  /** Ultra-terse mode active. Awaiting source text.parentId Parent node of replaced assistant message (usually user）。 */
  const onReload = useCallback(async (parentId: string | null) => {
    if (runningRef.current) return;
    const tree = itemsRef.current;
    const parent = parentId ? findMessage(tree, parentId) : null;
    let question = "";
    let userId = parentId;
    if (parent?.role === "user") {
      question = parent.content.trim();
    } else {
      // Fallback: find last along visible path. user
      const path = visibleMessages(tree, parentId ?? headIdRef.current);
      for (let i = path.length - 1; i >= 0; i -= 1) {
        if (path[i].role === "user") {
          question = path[i].content.trim();
          userId = path[i].id;
          break;
        }
      }
    }
    if (!question) return;

    const assistantId = makeId("a");
    const branchParent = userId || parentId;
    setItems((prev) => [
      ...prev,
      {
        parentId: branchParent,
        message: {
          id: assistantId,
          role: "assistant",
          content: "",
          progress: "Regenerating.…",
          status: { type: "running" },
          citations: [],
        },
      },
    ]);
    setHeadId(assistantId);
    await runAssistant(assistantId, question, {
      parentId: branchParent,
      regenerate: true,
    });
  }, [runAssistant]);

  /** Edit user message: at parentId Download latest user Rebase sibling branch and rerun. */
  const onEdit = useCallback(async (message: AppendMessage) => {
    if (runningRef.current) return;
    const question = textFromAppend(message);
    if (!question) return;

    const parentId = message.parentId ?? null;
    const userId = makeId("u");
    const assistantId = makeId("a");

    setItems((prev) => [
      ...prev,
      { parentId, message: { id: userId, role: "user", content: question } },
      {
        parentId: userId,
        message: {
          id: assistantId,
          role: "assistant",
          content: "",
progress: "Retrieving document...",
          status: { type: "running" },
          citations: [],
        },
      },
    ]);
    setHeadId(assistantId);
    await runAssistant(assistantId, question, {
      parentId,
      userMessageId: userId,
      regenerate: false,
    });
  }, [runAssistant]);

  const onCancel = useCallback(async () => {
    // True cancel: abort SSENo network./tokenand kill pending rAF Prevent state rollback. running
    runAbortRef.current?.abort();
    runAbortRef.current = null;
    if (streamRafRef.current != null) {
      cancelAnimationFrame(streamRafRef.current);
      streamRafRef.current = null;
    }
    streamAssistantIdRef.current = "";
    setStreamingAssistantId("");
    setStreamEpoch((n) => n + 1);
    runningRef.current = false;
    setIsRunning(false);
    setItems((prev) =>
      prev.map((item) =>
        item.message.status?.type === "running"
          ? {
            ...item,
            message: {
              ...item.message,
              status: { type: "incomplete", reason: "cancelled" as const },
              progress: "",
content: item.message.content.trim() || "Cancelled",
            },
          }
          : item,
      ),
    );
  }, []);

  /** Branch switch:runtime Pass in current visibility. ThreadMessage path, only change head。 */
  const setMessages = useCallback((next: readonly ThreadMessage[]) => {
    const last = next[next.length - 1];
    setHeadId(last?.id ?? null);
  }, []);

  const unstable_onBranchChange = useCallback((
    event: { headId: string | null },
  ) => {
    setHeadId(event.headId);
    // Sync server headcross-platform/Refresh visible branches.
    const convId =
      remoteAnswerer?.getConversationId?.()
      || loadStoredConversationId({ jobId });
    const head = `${event.headId || ""}`.trim();
    if (convId && head) {
      void patchConversation(convId, { head_id: head }).catch(() => {
// Offline/404 ignore, local tree still usable
      });
    }
  }, [jobId, remoteAnswerer]);

  const onImport = useCallback((imported: readonly ThreadMessage[]) => {
    const last = imported[imported.length - 1];
    if (last?.id) setHeadId(last.id);
  }, []);

/** New chat: clear bubbles, next ask will auto-create new conversation. */
  const newSession = useCallback(async () => {
    if (sessionBusy) return;
    // Allow new window during generation: true abort Pending requests; prevent stale stream writes to new window.
    runAbortRef.current?.abort();
    runAbortRef.current = null;
    runningRef.current = false;
    setIsRunning(false);
    armReaderAiClickShield(900);
    lockReaderAiNavigation(900);
    setSessionBusy(true);
    setSessionError("");
    const token = ++switchTokenRef.current;
    try {
      await new Promise<void>((r) => {
        window.setTimeout(r, 40);
      });
      if (token !== switchTokenRef.current) return;
      const docId = documentIdRef.current
        || `${(await remoteAnswerer?.getDocumentId?.()) || ""}`.trim();
      documentIdRef.current = docId;
      remoteAnswerer?.clearConversationId?.(docId);
      setActiveConversationId("");
      activeConversationIdRef.current = "";
      setItems([]);
      setHeadId(null);
      clearThreadBranchSnapshot(jobId);
      if (docId) await refreshSessions(docId);
    } catch (error) {
      console.warn("[reader-ai] new session failed", error);
      setSessionError("Failed to create new conversation. Please retry.");
    } finally {
      if (token === switchTokenRef.current) setSessionBusy(false);
    }
  }, [jobId, remoteAnswerer, refreshSessions, sessionBusy]);

  /** Switch existing session window. */
  const switchSession = useCallback(async (conversationId: string) => {
    const id = `${conversationId || ""}`.trim();
    const current =
      activeConversationIdRef.current
      || remoteAnswerer?.getConversationId?.()
      || "";
    if (!id || id === current || sessionBusy) return;

    // Allow navigation away during generation: true abort In-flight requests——Legacy stream. done Continuing will
    // conversation_id Paste into old session; next query lands in wrong thread (audit P0-4）
    runAbortRef.current?.abort();
    runAbortRef.current = null;
    runningRef.current = false;
    setIsRunning(false);

// Short isolation sufficient; prolonged causes "no response / random jumps"
    armReaderAiClickShield(1200);
    lockReaderAiNavigation(1200);
    setSessionBusy(true);
    setSessionError("");
    const token = ++switchTokenRef.current;

    // Cut first UI Selected state + Clear to prevent displaying previous session content.
    setActiveConversationId(id);
    activeConversationIdRef.current = id;
    setItems([]);
    setHeadId(null);

    const viewport = globalThis.document?.querySelector?.(
      "[data-reader-ai-viewport]",
    ) as HTMLElement | null;
    if (viewport) viewport.dataset.suppressAutoscroll = "1";

    try {
      await new Promise<void>((r) => {
        window.setTimeout(r, 80);
      });
      if (token !== switchTokenRef.current) return;

      try {
        (globalThis.document?.activeElement as HTMLElement | null)?.blur?.();
      } catch {
        // ignore
      }

      const docId = documentIdRef.current
        || `${(await remoteAnswerer?.getDocumentId?.()) || ""}`.trim();
      documentIdRef.current = docId;

      const detail = await getConversation(id);
      if (token !== switchTokenRef.current) return;

      armReaderAiClickShield(800);
      lockReaderAiNavigation(800);

      const branchItems = messagesToBranchItems(detail.messages || []);
      applyConversationTree(branchItems, detail.head_id);
      remoteAnswerer?.setConversationId?.(id, docId);

      // Align local snapshot with server (isolated by session)
      if (branchItems.length) {
        saveThreadBranchSnapshot(
          jobId,
          {
            version: 1,
            headId: `${detail.head_id || ""}`.trim()
              || branchItems[branchItems.length - 1]?.message.id
              || null,
            items: branchItems as ThreadBranchItem[],
          },
          id,
        );
      } else {
        clearThreadBranchSnapshot(jobId, id);
      }

      if (docId) await refreshSessions(docId);

      // Scroll only AI Panel. Don't touch. PDF
      requestAnimationFrame(() => {
        const vp = globalThis.document?.querySelector?.(
          "[data-reader-ai-viewport]",
        ) as HTMLElement | null;
        if (vp) {
          vp.scrollTop = vp.scrollHeight;
          window.setTimeout(() => {
            delete vp.dataset.suppressAutoscroll;
          }, 200);
        }
        armReaderAiClickShield(350);
        lockReaderAiNavigation(350);
      });
    } catch (error) {
      console.warn("[reader-ai] switch session failed", error);
      if (token === switchTokenRef.current) {
        setSessionError("Failed to load this conversation. Check network and retry.");
        // On failure, don't fake switch: reset to empty, avoid showing wrong session.
        setItems([]);
        setHeadId(null);
      }
    } finally {
      if (token === switchTokenRef.current) setSessionBusy(false);
    }
  }, [
    applyConversationTree,
    jobId,
    remoteAnswerer,
    refreshSessions,
    sessionBusy,
  ]);

  /**
* From a specific assistant answer "Start New Conversation":
* Copy history from root to this answer to a new conversation; original session is preserved as-is.
   * // Include only new session context in subsequent queries to prevent contamination from original thread continuation.ChatGPT Branch in new chat）。
   * @returns Success?
   */
  const branchFromAnswer = useCallback(async (assistantMessageId: string): Promise<boolean> => {
    const forkId = `${assistantMessageId || ""}`.trim();
    // Allow in busy Show error on queue failure. Allow cancellation during generation. forkstop local running）
    if (!forkId) {
      setSessionError("Cannot branch: message id Invalid.");
      return false;
    }
    if (sessionBusy) {
      setSessionError("Please wait. Session operation in progress.");
      return false;
    }
    if (runningRef.current) {
      runningRef.current = false;
      setIsRunning(false);
    }

    const path = pathForBranch(itemsRef.current, forkId, headIdRef.current);
    if (!path.length) {
      setSessionError("Cannot branch: conversation path to this answer not found.");
      return false;
    }
    const last = path[path.length - 1];
    if (last.message.role !== "assistant") {
      setSessionError("Start new chat only from assistant's reply.");
      return false;
    }

    setSessionBusy(true);
    setSessionError("");
    try {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 40);
      });

      let docId = documentIdRef.current
        || `${(await remoteAnswerer?.getDocumentId?.()) || ""}`.trim();
      documentIdRef.current = docId;
      if (!docId) {
        // Retry parsing.
        try {
          docId = `${(await remoteAnswerer?.getDocumentId?.()) || ""}`.trim();
          documentIdRef.current = docId;
        } catch {
          docId = "";
        }
      }
      if (!docId) {
        setSessionError("Cannot branch: document not ready. Retry later.");
        return false;
      }

      // Linearize parent, to ensure fork Write: ensure complete parent-child chain (independent of potentially broken legacy parentId）
      const pathPayload = path.map((item, i) => ({
        id: item.message.id,
        role: item.message.role as "user" | "assistant",
        content: item.message.content,
        citations: item.message.citations,
        parentId: i === 0 ? null : path[i - 1].message.id,
      }));

// Title: fork-n-xxx (xxx = current/original conversation name
      const currentId =
        activeConversationIdRef.current
        || remoteAnswerer?.getConversationId?.()
        || "";
      const currentRow = (sessions || []).find((s) => s.conversation_id === currentId);
      const firstUser = pathPayload.find((p) => p.role === "user");
      const sourceTitle =
        `${currentRow?.title || ""}`.trim()
        || `${firstUser?.content || ""}`.replace(/\s+/g, " ").trim()
|| "Untitled Conversation";
      const existingTitles = (sessions || []).map((s) => s.title || "");
      const branchTitle = nextForkConversationTitle(sourceTitle, existingTitles);

      // Must be complete fork Server-side (incl. messages): forbid empty session creation.
      const forked = await forkConversationFromPath({
        documentId: docId,
        title: branchTitle,
        path: pathPayload,
      });
      const nextItems = treeItemsFromBranchItems(forked.items);
      const nextHead = nextItems[nextItems.length - 1]?.message.id || null;
      const nextConvId = forked.conversation.conversation_id;
      if (!nextConvId || !nextItems.length) {
        throw new Error("fork returned empty conversation");
      }

      armReaderAiClickShield(600);
      lockReaderAiNavigation(600);

      // Switch to new session: original remains in list, switchable.
      setItems(nextItems);
      setHeadId(nextHead);
      setActiveConversationId(nextConvId);
      activeConversationIdRef.current = nextConvId;
      remoteAnswerer?.setConversationId?.(nextConvId, docId);

      // Optimistically insert list (with correct title and message count), then refresh Align with server.
      setSessions((prev) => {
        const row: ConversationRecord = {
          conversation_id: nextConvId,
          title: branchTitle,
          document_id: docId,
          created_at: forked.conversation.created_at || new Date().toISOString(),
          updated_at: forked.conversation.updated_at || new Date().toISOString(),
          message_count: nextItems.length,
          head_id: nextHead || "",
        };
        const without = prev.filter((s) => s.conversation_id !== nextConvId);
        return [row, ...without];
      });

      saveThreadBranchSnapshot(
        jobId,
        snapshotFromTree(nextItems, nextHead),
        nextConvId,
      );
      await refreshSessions(docId);

      // Scroll to end. Continue query.
      requestAnimationFrame(() => {
        const vp = globalThis.document?.querySelector?.(
          "[data-reader-ai-viewport]",
        ) as HTMLElement | null;
        if (vp) {
          delete vp.dataset.suppressAutoscroll;
          vp.scrollTop = vp.scrollHeight;
        }
      });
      return true;
    } catch (error) {
      console.warn("[reader-ai] branch from answer failed", error);
      setSessionError("Branch failed: could not copy previous conversation to new chat. Check network and retry.");
      return false;
    } finally {
      setSessionBusy(false);
    }
  }, [jobId, remoteAnswerer, refreshSessions, sessionBusy, sessions]);

  /** Delete session (server-side + Local snapshot; delete current switches to most recent or empty window. */
  const removeSession = useCallback(async (conversationId: string) => {
    const id = `${conversationId || ""}`.trim();
    if (!id || sessionBusy) return;
    runningRef.current = false;
    setIsRunning(false);
    setSessionBusy(true);
    setSessionError("");
    const token = ++switchTokenRef.current;
    try {
      const docId = documentIdRef.current
        || `${(await remoteAnswerer?.getDocumentId?.()) || ""}`.trim();
      documentIdRef.current = docId;

      try {
        await deleteConversation(id);
      } catch (error) {
        const status = Number((error as { status?: number })?.status) || 0;
        if (status !== 404) throw error;
      }
      clearThreadBranchSnapshot(jobId, id);

      const current =
        activeConversationIdRef.current
        || remoteAnswerer?.getConversationId?.()
        || "";
      const deletingActive = current === id;

      setSessions((prev) => prev.filter((s) => s.conversation_id !== id));

      if (deletingActive) {
        remoteAnswerer?.clearConversationId?.(docId);
        setActiveConversationId("");
        activeConversationIdRef.current = "";
        setItems([]);
        setHeadId(null);
        clearThreadBranchSnapshot(jobId);

        const list = docId
          ? ((await listConversations({ document_id: docId, limit: 50 }).catch(
            () => ({ conversations: [] as ConversationRecord[] }),
          )).conversations || [])
          : [];
        if (token !== switchTokenRef.current) return;
        setSessions(list);

        const next = list[0];
        if (next?.conversation_id) {
          const nextId = next.conversation_id;
          setActiveConversationId(nextId);
          activeConversationIdRef.current = nextId;
          try {
            const detail = await getConversation(nextId);
            if (token !== switchTokenRef.current) return;
            applyConversationTree(
              messagesToBranchItems(detail.messages || []),
              detail.head_id,
            );
            remoteAnswerer?.setConversationId?.(nextId, docId);
          } catch {
            setItems([]);
            setHeadId(null);
          }
        }
      } else if (docId) {
        await refreshSessions(docId);
      }
    } catch (error) {
      console.warn("[reader-ai] delete session failed", error);
      setSessionError("Delete conversation failed. Retry.");
    } finally {
      if (token === switchTokenRef.current) setSessionBusy(false);
    }
  }, [applyConversationTree, jobId, remoteAnswerer, refreshSessions, sessionBusy]);

  /** Rename session title. */
  const renameSession = useCallback(async (conversationId: string, title: string) => {
    const id = `${conversationId || ""}`.trim();
    const nextTitle = `${title || ""}`.replace(/\s+/g, " ").trim();
    if (!id || !nextTitle || sessionBusy) return;
    setSessionBusy(true);
    setSessionError("");
    try {
      const clipped = nextTitle.slice(0, 80);
      await patchConversation(id, { title: clipped });
      setSessions((prev) =>
        prev.map((s) =>
          s.conversation_id === id ? { ...s, title: clipped } : s,
        ),
      );
      const docId = documentIdRef.current;
      if (docId) await refreshSessions(docId);
    } catch (error) {
      console.warn("[reader-ai] rename session failed", error);
      setSessionError("Rename failed. Please try again.");
    } finally {
      setSessionBusy(false);
    }
  }, [refreshSessions, sessionBusy]);

// After Q&A completes, refresh session list titles/sorting
  const prevRunning = useRef(false);
  useEffect(() => {
    if (prevRunning.current && !isRunning) {
      const docId = documentIdRef.current;
      if (docId) void refreshSessions(docId);
      const id = remoteAnswerer?.getConversationId?.() || "";
      if (id) setActiveConversationId(id);
    }
    prevRunning.current = isRunning;
  }, [isRunning, remoteAnswerer, refreshSessions]);

  const runtime = useExternalStoreRuntime({
    isRunning,
// Switch session/Don't spawn threads on branch. isDisabled(will flash disabled state like refresh); button side uses branchBusy lock
    isDisabled: !enabled,
    messageRepository,
    setMessages,
    unstable_onBranchChange,
    onNew,
    onReload,
    onEdit,
    onCancel,
    onImport,
    suggestions: messages.length === 0 ? SUGGESTIONS : [],
  });

  const sessionSummaries: ReaderAskSessionSummary[] = useMemo(() => {
    const active = activeConversationId
      || remoteAnswerer?.getConversationId?.()
      || "";
    return (sessions || []).map((s) => ({
      id: s.conversation_id,
title: `${s.title || ""}`.trim() || "Untitled Conversation",
      updatedAt: s.updated_at || "",
      messageCount: Number(s.message_count) || 0,
      active: s.conversation_id === active,
    }));
  }, [sessions, activeConversationId, remoteAnswerer]);

  return {
    runtime,
    citationsByMessageId,
    progressByMessageId,
    contentByMessageId,
    streamingAssistantId,
    isRunning,
    messages,
    sessions: sessionSummaries,
    activeConversationId: activeConversationId
      || remoteAnswerer?.getConversationId?.()
      || "",
    sessionBusy,
    sessionError,
    newSession,
    switchSession,
    removeSession,
    renameSession,
    branchFromAnswer,
  };
}
