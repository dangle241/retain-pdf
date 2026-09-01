// assistant-ui ExternalStore: Progress/正文m离 + 消息branch树 + books地快照.

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
  { prompt: "What are the main conclusions of this paper?" },
  { prompt: "What methods or models did the authors use?" },
  { prompt: "What are the key results or data?" },
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
  // 注意: fromThreadMessageLike 会丢掉 trim 为空的 text part；
  // 流式占位用可见点, 避免 content=[] 时气泡不挂载 Parts.
  const raw = message.content;
  const isAssistant = message.role === "assistant";
  const content = raw.trim()
    ? raw
    : isAssistant && message.status?.type === "running"
      ? "..."
      : raw;
  // assistant-ui fromBranchableArray: status 只能出现在 assistant, no则
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

/** 从任意消息沿 parent 回溯到根, 得到路径上的 TreeItem 序列(根→叶). */
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
 * branch用路径: 优先 parent 链；链断/缺 parent 时退化为"可见路径截到目标Answer".
 * 避免只 fork 出半截(甚至只有一entries assistant)导致"branch不像New conversation/None上文".
 */
function pathForBranch(
  items: readonly TreeItem[],
  targetId: string,
  headId: string | null,
): TreeItem[] {
  const tid = `${targetId || ""}`.trim();
  if (!tid || !items.length) return [];

  // aui 有时用自己的 id；优先精确匹配, 再回退到Current head / 最近 assistant
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
  // parent 链完整: 至少含 user+assistant
  if (path.length >= 2 && path[path.length - 1].message.role === "assistant") {
    return path;
  }
  if (path.length === 1 && path[0].message.role === "user") {
    path = [];
  }

  // Fallback: 按Current可见线性顺序, 从根截到 target(含)
  const visible = visibleMessages(items, headId || resolvedId);
  let idx = visible.findIndex((m) => m.id === resolvedId);
  if (idx < 0) {
    // 再退: 整entries可见路径(以 head 为叶)
    idx = visible.length - 1;
  }
  if (idx < 0) return path;
  const byId = new Map(items.map((i) => [i.message.id, i]));
  const linear: TreeItem[] = [];
  for (let i = 0; i <= idx; i += 1) {
    const row = byId.get(visible[i].id);
    if (row) linear.push(row);
  }
  // 确保以 assistant 结尾
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
  // 贯穿单次 runAssistant 的Cancel把手: onCancel/切会话/新会话/连发前 abort.
  // 审计 P0-2/3/4 的total同Root Cause就yes此前没有它——停止不断流, Done流复活Canceled
  // 消息, 旧流回写会话粘性, 全靠这一个 controller 消掉.
  const runAbortRef = useRef<AbortController | null>(null);
  const itemsRef = useRef(items);
  const headIdRef = useRef(headId);
  const activeConversationIdRef = useRef(activeConversationId);
  const streamRafRef = useRef<number | null>(null);
  const pendingContentRef = useRef("");
  const streamAssistantIdRef = useRef("");
  /** 流式正文旁路(不依赖 aui Parts / status), 保证 token 到即刷 */
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
      // ListFailed不挡主Workflow
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

  // job 切换 / 面板打开: 拉会话List + hydrate 消息树
  // 注意: 面板Close时 enabled=false 也会跑 effect；不能用 lastJobRef 在 enabled 翻转时直接 return, 
  // no则"打开面板"永远不会 refreshSessions(用户只能New conversation后才看到List).
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

    // 面板未打开: 只记 job, 等 enabled 再拉网
    if (!enabled || !remoteAnswerer) return;

    let cancelled = false;
    void (async () => {
      // 1) parse document_id(List按Documents过滤)
      let docId = `${documentIdRef.current || ""}`.trim();
      if (!docId) {
        try {
          docId = `${(await remoteAnswerer.getDocumentId?.()) || ""}`.trim();
        } catch {
          docId = "";
        }
        if (docId) documentIdRef.current = docId;
      }

      // 2) 始终刷新会话List(打开面板 / 切 job 都要)
      if (!cancelled && docId) {
        await refreshSessions(docId);
      }

      // 3) 消息树: job 刚切换, 或Current还yes空树时再 hydrate
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
          // 网络/404 → books地快照
        }
      }

      // None粘性会话: 若List里已有对话, 自动挂最近一entries, 便于直接切换
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

  // 防抖持久化全量树(按会话隔离)
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

  /** 流式正文旁路: store + In progress的 streamContent(streamEpoch 强制刷新) */
  const contentByMessageId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of items) {
      const m = item.message;
      if (m.content) map[m.id] = m.content;
    }
    // 覆盖为最新流式缓冲(可能比 items 里多半帧)
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

  // 流式清洗降频: sanitize 从"每 token 一次"移到"每帧一次"(rAF flush 内), 
  // 长Answer不再对全文反复跑 5 entries正则(审计 P1-7 O(n²)).
  // 语义不变: 清洗后为空则回退Source, 保证可见增量.
  const sanitizeStreamText = useCallback((raw: string) => {
    const cleaned = sanitizeAssistantAnswer(raw || "", []);
    return cleaned.trim() ? cleaned : `${raw || ""}`;
  }, []);

  const scheduleAnswerText = useCallback((assistantId: string, text: string) => {
    const next = `${text || ""}`;
    pendingContentRef.current = next;
    answerStartedRef.current = true;
    streamAssistantIdRef.current = assistantId;

    // 首包: sync上屏(旁路 + store), 避免等 rAF / aui status
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

    // 后续: 每帧最多 flush 一次旁路；store 也Updates以免切消息丢字
    if (streamRafRef.current != null) return;
    streamRafRef.current = requestAnimationFrame(() => {
      streamRafRef.current = null;
      // 陈旧守卫: Cancel/连发后 pendingContentRef 已属于新流, 
      // 旧 rAF 不许把它写进旧气泡(审计 P0-3 串流)
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

  // 卸载(关浮窗/离开Pages)时断掉在飞请求, 不留幽灵 SSE
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
        content: "Q&A is not ready yet. Make sure the job reader is open.",
        progress: "",
        status: { type: "incomplete", reason: "error" },
      });
      return;
    }

    // 连发保护: 终止上一在飞请求, 再开新 controller
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
    // 占位 running, 确保 UI 走流式路径
    patchAssistant(assistantId, {
      content: "",
      progress: "Searching documents...",
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
            // Source直接入队, 清洗在 scheduleAnswerText 的帧级 flush 里做
            //(每 token 全文 sanitize yes O(n²), 审计 P1-7)
            if (fullText) scheduleAnswerText(assistantId, fullText);
          },
          signal: controller.signal,
        });
      } catch (error) {
        // 主动Cancel: 不降级, 不报错, 气泡Status已由 onCancel 定格
        if (controller.signal.aborted) return;
        if (!localAnswerer || !shouldFallbackToLocal(error)) throw error;
        usedFallback = true;
        if (!answerStartedRef.current) {
          patchAssistant(assistantId, {
            progress: "Online service is not ready. Falling back to local search...",
            status: { type: "running" },
          });
        }
        await localAnswerer.ensureLoaded?.(jobId);
        result = await localAnswerer.answer({ question, scope: "document" });
      }

      // Done前最后一道闸: Canceled的运行禁止用完整Answer覆盖"Canceled"气泡
      if (controller.signal.aborted) return;
      if (streamRafRef.current != null) {
        cancelAnimationFrame(streamRafRef.current);
        streamRafRef.current = null;
      }
      const citations = normalizeCitations(result?.citations);
      let answer = sanitizeAssistantAnswer(
        `${result?.answer || pendingContentRef.current || ""}`.trim() || "No ready answer was found.",
        citations,
      );
      if (usedFallback) {
        answer = `${answer}\n\n_在线服务暂不Ready, 以上来自books地DocumentsSearch._`;
      }
      if ((result as { persisted?: boolean })?.persisted === false) {
        // 审计 C2:回写Failed不再静默——用户至少知道该CopySave
        answer = `${answer}\n\n_⚠️ books轮回答未能写入History记录(存储暂时不Ready), 刷新后可能丢失._`;
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
      // 主动Cancel抛出的 AbortError 不算Failed, 气泡已由 onCancel 定格
      if (controller.signal.aborted) return;
      if (streamRafRef.current != null) {
        cancelAnimationFrame(streamRafRef.current);
        streamRafRef.current = null;
      }
      delete streamContentRef.current[assistantId];
      streamAssistantIdRef.current = "";
      setStreamingAssistantId("");
      setStreamEpoch((n) => n + 1);
      const msg = error instanceof Error ? error.message : "Failed to generate an answer. Please retry.";
      patchAssistant(assistantId, {
        content: msg,
        progress: "",
        citations: [],
        status: { type: "incomplete", reason: "error" },
      });
    } finally {
      // 只有"仍yesCurrent运行"才复位全局标志: 旧 run 的 finally 不许踩新 run
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

    // 优先 append 自带的 parentId: 从某entriesAnswer"branch"时 parent = 该 assistant id
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
          progress: "Searching documents...",
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

  /** 重新生成: parentId 为被替换助手消息的父节点(通常yes user). */
  const onReload = useCallback(async (parentId: string | null) => {
    if (runningRef.current) return;
    const tree = itemsRef.current;
    const parent = parentId ? findMessage(tree, parentId) : null;
    let question = "";
    let userId = parentId;
    if (parent?.role === "user") {
      question = parent.content.trim();
    } else {
      // 兜底: 沿可见路径找最后一个 user
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
          progress: "Regenerating...",
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

  /** Edit用户消息: 在 parentId 下长出新 user 兄弟branch并rerun. */
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
          progress: "Searching documents...",
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
    // 真Cancel: 断 SSE(省网络/token), 并掐灭 pending rAF 防止把Status打回 running
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
              content: item.message.content.trim() || "Canceled",
            },
          }
          : item,
      ),
    );
  }, []);

  /** branch切换: runtime 传入Current可见 ThreadMessage 路径, 只改 head. */
  const setMessages = useCallback((next: readonly ThreadMessage[]) => {
    const last = next[next.length - 1];
    setHeadId(last?.id ?? null);
  }, []);

  const unstable_onBranchChange = useCallback((
    event: { headId: string | null },
  ) => {
    setHeadId(event.headId);
    // sync服务端 head, 跨端/刷新保持可见branch
    const convId =
      remoteAnswerer?.getConversationId?.()
      || loadStoredConversationId({ jobId });
    const head = `${event.headId || ""}`.trim();
    if (convId && head) {
      void patchConversation(convId, { head_id: head }).catch(() => {
        // 离线/404 忽略, books地树仍Ready
      });
    }
  }, [jobId, remoteAnswerer]);

  const onImport = useCallback((imported: readonly ThreadMessage[]) => {
    const last = imported[imported.length - 1];
    if (last?.id) setHeadId(last.id);
  }, []);

  /** New conversation窗口: 清空气泡, 下次 ask 会 auto-create 新 conversation. */
  const newSession = useCallback(async () => {
    if (sessionBusy) return;
    // Generating也允许开新窗: 真 abort 在飞请求, 防旧流写进新窗口
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
      setSessionError("CannotCreatedNew conversation, 请Retry.");
    } finally {
      if (token === switchTokenRef.current) setSessionBusy(false);
    }
  }, [jobId, remoteAnswerer, refreshSessions, sessionBusy]);

  /** 切换已有会话窗口. */
  const switchSession = useCallback(async (conversationId: string) => {
    const id = `${conversationId || ""}`.trim();
    const current =
      activeConversationIdRef.current
      || remoteAnswerer?.getConversationId?.()
      || "";
    if (!id || id === current || sessionBusy) return;

    // Generating也允许切走: 真 abort 在飞请求——旧流的 done 若继续, 会把
    // conversation_id 粘回旧会话, 下一问落错线程(审计 P0-4)
    runAbortRef.current?.abort();
    runAbortRef.current = null;
    runningRef.current = false;
    setIsRunning(false);

    // 短时隔离即可；过长会像"点了没反应 / 乱跳"
    armReaderAiClickShield(1200);
    lockReaderAiNavigation(1200);
    setSessionBusy(true);
    setSessionError("");
    const token = ++switchTokenRef.current;

    // 先切 UI 选中态 + 清空, 避免仍Display上一会话内容
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

      // books地快照与服务端对齐(按会话隔离)
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

      // 只滚 AI 面板, 不碰 PDF
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
        setSessionError("加载该对话Failed, 请检查网络后Retry.");
        // Failed时不要假装已切换: resume为空, 避免展示错会话
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
   * 从某entries助手Answer"开New conversation": 
   * Copy root→该Answer 的History到新 conversation, 原会话原样保留.
   * 之后提问只带新会话上下文, 避免原线程被续写污染(ChatGPT Branch in new chat).
   * @returns yesno成功
   */
  const branchFromAnswer = useCallback(async (assistantMessageId: string): Promise<boolean> => {
    const forkId = `${assistantMessageId || ""}`.trim();
    // 允许在 busy 时queuedFailed要有提示；Generating也可 fork(先停books地 running)
    if (!forkId) {
      setSessionError("Cannotbranch: 消息 id None效.");
      return false;
    }
    if (sessionBusy) {
      setSessionError("Please wait. A conversation operation is already in progress.");
      return false;
    }
    if (runningRef.current) {
      runningRef.current = false;
      setIsRunning(false);
    }

    const path = pathForBranch(itemsRef.current, forkId, headIdRef.current);
    if (!path.length) {
      setSessionError("Cannotbranch: 找不到到此Answer的对话路径.");
      return false;
    }
    const last = path[path.length - 1];
    if (last.message.role !== "assistant") {
      setSessionError("只能从助手Answer处开New conversation.");
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
        // 再试一次parse
        try {
          docId = `${(await remoteAnswerer?.getDocumentId?.()) || ""}`.trim();
          documentIdRef.current = docId;
        } catch {
          docId = "";
        }
      }
      if (!docId) {
        setSessionError("Cannotbranch: Documents未就绪, Please retry later.");
        return false;
      }

      // 线性化 parent, 保证 fork 写入时父子链完整(不依赖可能断裂的旧 parentId)
      const pathPayload = path.map((item, i) => ({
        id: item.message.id,
        role: item.message.role as "user" | "assistant",
        content: item.message.content,
        citations: item.message.citations,
        parentId: i === 0 ? null : path[i - 1].message.id,
      }));

      // Title: fork-n-xxx(xxx = Current/原始对话名)
      const currentId =
        activeConversationIdRef.current
        || remoteAnswerer?.getConversationId?.()
        || "";
      const currentRow = (sessions || []).find((s) => s.conversation_id === currentId);
      const firstUser = pathPayload.find((p) => p.role === "user");
      const sourceTitle =
        `${currentRow?.title || ""}`.trim()
        || `${firstUser?.content || ""}`.replace(/\s+/g, " ").trim()
        || "Untitled conversation";
      const existingTitles = (sessions || []).map((s) => s.title || "");
      const branchTitle = nextForkConversationTitle(sourceTitle, existingTitles);

      // 必须完整 fork 到服务端(含消息), 禁止只建空会话
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

      // 切到新会话: 原会话仍在List里可切回
      setItems(nextItems);
      setHeadId(nextHead);
      setActiveConversationId(nextConvId);
      activeConversationIdRef.current = nextConvId;
      remoteAnswerer?.setConversationId?.(nextConvId, docId);

      // 乐观插入List(带正确Title与消息数), 再 refresh 对齐服务端
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

      // New conversation: 滚到末尾, 方便接着问
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
      setSessionError("branchFailed: 未能Copy上文到New conversation.请检查网络后Retry.");
      return false;
    } finally {
      setSessionBusy(false);
    }
  }, [jobId, remoteAnswerer, refreshSessions, sessionBusy, sessions]);

  /** Delete会话(服务端 + books地快照)；删Current则切到最近一entries或空窗. */
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
      setSessionError("Delete conversationFailed, 请Retry.");
    } finally {
      if (token === switchTokenRef.current) setSessionBusy(false);
    }
  }, [applyConversationTree, jobId, remoteAnswerer, refreshSessions, sessionBusy]);

  /** Rename会话Title. */
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
      setSessionError("RenameFailed, 请Retry.");
    } finally {
      setSessionBusy(false);
    }
  }, [refreshSessions, sessionBusy]);

  // 问答Done后刷新会话ListTitle/Sort
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
    // 切会话/branch时不要整线程 isDisabled(会闪禁用态像刷新)；按钮侧用 branchBusy 锁
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
      title: `${s.title || ""}`.trim() || "Untitled conversation",
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





