// ExternalStore của assistant-ui: tách tiến độ/nội dung + cây nhánh tin nhắn + snapshot cục bộ.

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
  { prompt: "Kết luận chính của tài liệu này là gì?" },
  { prompt: "Tác giả đã dùng phương pháp hoặc mô hình nào?" },
  { prompt: "Có những kết quả hoặc dữ liệu quan trọng nào?" },
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
  // Lưu ý: fromThreadMessageLike sẽ bỏ text part rỗng sau trim;
  // placeholder streaming dùng dấu chấm hiển thị để tránh việc bong bóng không mount Parts khi content=[].
  const raw = message.content;
  const isAssistant = message.role === "assistant";
  const content = raw.trim()
    ? raw
    : isAssistant && message.status?.type === "running"
      ? "…"
      : raw;
  // assistant-ui fromBranchableArray: status chỉ được xuất hiện trong assistant, nếu không sẽ lỗi.
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

/** Từ tin nhắn bất kỳ, lần theo parent về gốc để lấy chuỗi TreeItem trên đường đi (gốc → lá). */
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
 * Đường dẫn dùng khi phân nhánh: ưu tiên chuỗi parent; khi chuỗi đứt/thiếu parent, fallback thành "đường hiển thị cắt tới câu trả lời đích".
 * Tránh fork chỉ một đoạn (thậm chí chỉ một assistant) khiến "nhánh không giống hội thoại mới/không có ngữ cảnh trước".
 */
function pathForBranch(
  items: readonly TreeItem[],
  targetId: string,
  headId: string | null,
): TreeItem[] {
  const tid = `${targetId || ""}`.trim();
  if (!tid || !items.length) return [];

  // aui đôi khi dùng ID riêng; ưu tiên khớp chính xác, sau đó fallback về head hiện tại / assistant gần nhất.
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
  // Chuỗi parent hoàn chỉnh: ít nhất gồm user + assistant.
  if (path.length >= 2 && path[path.length - 1].message.role === "assistant") {
    return path;
  }
  if (path.length === 1 && path[0].message.role === "user") {
    path = [];
  }

  // Fallback: theo thứ tự tuyến tính đang hiển thị, cắt từ gốc tới target (bao gồm target).
  const visible = visibleMessages(items, headId || resolvedId);
  let idx = visible.findIndex((m) => m.id === resolvedId);
  if (idx < 0) {
    // Fallback tiếp: toàn bộ đường hiển thị (head là lá).
    idx = visible.length - 1;
  }
  if (idx < 0) return path;
  const byId = new Map(items.map((i) => [i.message.id, i]));
  const linear: TreeItem[] = [];
  for (let i = 0; i <= idx; i += 1) {
    const row = byId.get(visible[i].id);
    if (row) linear.push(row);
  }
  // Bảo đảm kết thúc bằng assistant.
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
  // Bộ điều khiển hủy xuyên suốt một lần runAssistant: abort trước onCancel/đổi hội thoại/hội thoại mới/gửi liên tiếp.
  // Nguyên nhân chung của kiểm tra P0-2/3/4 là trước đây thiếu nó: Dừng không ngắt stream, stream hoàn tất làm sống lại tin nhắn đã hủy,
  // stream cũ ghi lại tính dính của hội thoại; một controller này xử lý tất cả.
  const runAbortRef = useRef<AbortController | null>(null);
  const itemsRef = useRef(items);
  const headIdRef = useRef(headId);
  const activeConversationIdRef = useRef(activeConversationId);
  const streamRafRef = useRef<number | null>(null);
  const pendingContentRef = useRef("");
  const streamAssistantIdRef = useRef("");
  /** Đường tắt nội dung streaming (không phụ thuộc aui Parts / status), bảo đảm token tới là cập nhật. */
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
      // Lỗi danh sách không chặn luồng chính.
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

  // Đổi tác vụ / mở panel: tải danh sách hội thoại + hydrate cây tin nhắn.
  // Lưu ý: khi panel đóng, effect vẫn chạy với enabled=false; không thể dùng lastJobRef để return ngay khi enabled đổi,
  // nếu không "mở panel" sẽ không bao giờ refreshSessions (người dùng chỉ thấy danh sách sau khi tạo hội thoại mới).
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

    // Panel chưa mở: chỉ ghi nhớ tác vụ, chờ enabled rồi mới gọi mạng.
    if (!enabled || !remoteAnswerer) return;

    let cancelled = false;
    void (async () => {
      // 1. Phân giải document_id (danh sách lọc theo tài liệu).
      let docId = `${documentIdRef.current || ""}`.trim();
      if (!docId) {
        try {
          docId = `${(await remoteAnswerer.getDocumentId?.()) || ""}`.trim();
        } catch {
          docId = "";
        }
        if (docId) documentIdRef.current = docId;
      }

      // 2. Luôn làm mới danh sách hội thoại (cả khi mở panel và đổi tác vụ).
      if (!cancelled && docId) {
        await refreshSessions(docId);
      }

      // 3. Cây tin nhắn: hydrate khi vừa đổi tác vụ hoặc cây hiện tại vẫn rỗng.
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
          // Mạng/404 → snapshot cục bộ.
        }
      }

      // Không có hội thoại dính: nếu danh sách đã có hội thoại, tự gắn hội thoại gần nhất để dễ chuyển trực tiếp.
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

  // Debounce việc lưu toàn bộ cây (cách ly theo hội thoại).
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

  /** Đường tắt nội dung streaming: store + streamContent đang chạy (streamEpoch buộc làm mới). */
  const contentByMessageId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of items) {
      const m = item.message;
      if (m.content) map[m.id] = m.content;
    }
    // Ghi đè bằng buffer streaming mới nhất (có thể đi trước items nửa frame).
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

  // Giảm tần suất làm sạch streaming: chuyển sanitize từ "mỗi token một lần" sang "mỗi frame một lần" (trong rAF flush),
  // câu trả lời dài không còn chạy lặp năm regex trên toàn văn (kiểm tra P1-7, O(n²)).
  // Ngữ nghĩa không đổi: nếu rỗng sau làm sạch thì fallback về nguyên văn, bảo đảm phần tăng thêm vẫn hiển thị.
  const sanitizeStreamText = useCallback((raw: string) => {
    const cleaned = sanitizeAssistantAnswer(raw || "", []);
    return cleaned.trim() ? cleaned : `${raw || ""}`;
  }, []);

  const scheduleAnswerText = useCallback((assistantId: string, text: string) => {
    const next = `${text || ""}`;
    pendingContentRef.current = next;
    answerStartedRef.current = true;
    streamAssistantIdRef.current = assistantId;

    // Gói đầu: hiển thị đồng bộ (đường tắt + store), tránh chờ rAF / trạng thái aui.
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

    // Sau đó: mỗi frame flush đường tắt tối đa một lần; store cũng cập nhật để tránh mất chữ khi đổi tin nhắn.
    if (streamRafRef.current != null) return;
    streamRafRef.current = requestAnimationFrame(() => {
      streamRafRef.current = null;
      // Chốt chống dữ liệu cũ: sau khi hủy/gửi liên tiếp, pendingContentRef đã thuộc stream mới,
      // rAF cũ không được ghi nó vào bong bóng cũ (kiểm tra P0-3, lẫn stream).
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

  // Khi unmount (đóng cửa sổ nổi/rời trang), ngắt yêu cầu đang chạy, không để SSE sót lại.
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
        content: "Hỏi đáp tạm thời không khả dụng; hãy xác nhận trình đọc tác vụ đã được mở.",
        progress: "",
        status: { type: "incomplete", reason: "error" },
      });
      return;
    }

    // Bảo vệ gửi liên tiếp: dừng yêu cầu đang chạy trước rồi tạo controller mới.
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
    // Placeholder running bảo đảm UI đi theo nhánh streaming.
    patchAssistant(assistantId, {
      content: "",
      progress: "Đang tìm kiếm trong tài liệu…",
      status: { type: "running" },
    });

    try {
      await remoteAnswerer?.ensureLoaded?.();
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
            // Đưa nguyên văn thẳng vào hàng đợi; làm sạch trong flush theo frame của scheduleAnswerText
            //(sanitize toàn văn cho mỗi token là O(n²), kiểm tra P1-7).
            if (fullText) scheduleAnswerText(assistantId, fullText);
          },
          signal: controller.signal,
        });
      } catch (error) {
        // Chủ động hủy: không fallback, không báo lỗi; trạng thái bong bóng đã được onCancel cố định.
        if (controller.signal.aborted) return;
        if (!localAnswerer || !shouldFallbackToLocal(error)) throw error;
        usedFallback = true;
        if (!answerStartedRef.current) {
          patchAssistant(assistantId, {
            progress: "Dịch vụ trực tuyến tạm thời không khả dụng, chuyển sang tìm kiếm cục bộ…",
            status: { type: "running" },
          });
        }
        await localAnswerer.ensureLoaded?.(jobId);
        result = await localAnswerer.answer({ question, scope: "document" });
      }

      // Chốt cuối trước khi hoàn tất: lần chạy đã hủy không được dùng câu trả lời đầy đủ ghi đè bong bóng "Đã hủy".
      if (controller.signal.aborted) return;
      if (streamRafRef.current != null) {
        cancelAnimationFrame(streamRafRef.current);
        streamRafRef.current = null;
      }
      const citations = normalizeCitations(result?.citations);
      let answer = sanitizeAssistantAnswer(
        `${result?.answer || pendingContentRef.current || ""}`.trim() || "Không tìm thấy câu trả lời phù hợp.",
        citations,
      );
      if (usedFallback) {
        answer = `${answer}\n\n_Dịch vụ trực tuyến tạm thời không khả dụng; nội dung trên đến từ tìm kiếm tài liệu cục bộ._`;
      }
      if ((result as { persisted?: boolean })?.persisted === false) {
        // Kiểm tra C2: lỗi ghi lại không còn im lặng; ít nhất người dùng biết cần sao chép để lưu.
        answer = `${answer}\n\n_⚠️ Không thể ghi câu trả lời này vào lịch sử (bộ nhớ tạm thời không khả dụng); nội dung có thể mất sau khi làm mới._`;
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
      // AbortError do chủ động hủy không được tính là thất bại; bong bóng đã được onCancel cố định.
      if (controller.signal.aborted) return;
      if (streamRafRef.current != null) {
        cancelAnimationFrame(streamRafRef.current);
        streamRafRef.current = null;
      }
      delete streamContentRef.current[assistantId];
      streamAssistantIdRef.current = "";
      setStreamingAssistantId("");
      setStreamEpoch((n) => n + 1);
      const msg = error instanceof Error ? error.message : "Không thể tạo câu trả lời, vui lòng thử lại.";
      patchAssistant(assistantId, {
        content: msg,
        progress: "",
        citations: [],
        status: { type: "incomplete", reason: "error" },
      });
    } finally {
      // Chỉ đặt lại cờ toàn cục khi "vẫn là lần chạy hiện tại"; finally của lần chạy cũ không được đè lần chạy mới.
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

    // Ưu tiên parentId có sẵn trong append: khi "phân nhánh" từ một câu trả lời, parent = ID assistant đó.
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
          progress: "Đang tìm kiếm trong tài liệu…",
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

  /** Tạo lại: parentId là nút cha của tin nhắn assistant bị thay thế (thường là user). */
  const onReload = useCallback(async (parentId: string | null) => {
    if (runningRef.current) return;
    const tree = itemsRef.current;
    const parent = parentId ? findMessage(tree, parentId) : null;
    let question = "";
    let userId = parentId;
    if (parent?.role === "user") {
      question = parent.content.trim();
    } else {
      // Dự phòng: tìm user cuối cùng trên đường hiển thị.
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
          progress: "Đang tạo lại…",
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

  /** Sửa tin nhắn người dùng: tạo nhánh user anh em mới dưới parentId và chạy lại. */
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
          progress: "Đang tìm kiếm trong tài liệu…",
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
    // Hủy thật: ngắt SSE (tiết kiệm mạng/token) và dừng rAF đang chờ để tránh đặt trạng thái lại thành running.
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
              content: item.message.content.trim() || "Đã hủy",
            },
          }
          : item,
      ),
    );
  }, []);

  /** Chuyển nhánh: runtime truyền đường ThreadMessage đang hiển thị, chỉ sửa head. */
  const setMessages = useCallback((next: readonly ThreadMessage[]) => {
    const last = next[next.length - 1];
    setHeadId(last?.id ?? null);
  }, []);

  const unstable_onBranchChange = useCallback((
    event: { headId: string | null },
  ) => {
    setHeadId(event.headId);
    // Đồng bộ head phía server để giữ nhánh hiển thị khi đổi thiết bị/làm mới.
    const convId =
      remoteAnswerer?.getConversationId?.()
      || loadStoredConversationId({ jobId });
    const head = `${event.headId || ""}`.trim();
    if (convId && head) {
      void patchConversation(convId, { head_id: head }).catch(() => {
        // Bỏ qua offline/404, cây cục bộ vẫn dùng được.
      });
    }
  }, [jobId, remoteAnswerer]);

  const onImport = useCallback((imported: readonly ThreadMessage[]) => {
    const last = imported[imported.length - 1];
    if (last?.id) setHeadId(last.id);
  }, []);

  /** Cửa sổ hội thoại mới: xóa bong bóng; lần ask sau sẽ tự tạo conversation mới. */
  const newSession = useCallback(async () => {
    if (sessionBusy) return;
    // Cho phép mở cửa sổ mới khi đang tạo: thực sự abort yêu cầu đang chạy để ngăn stream cũ ghi vào cửa sổ mới.
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
      setSessionError("Không thể tạo cuộc trò chuyện mới, vui lòng thử lại.");
    } finally {
      if (token === switchTokenRef.current) setSessionBusy(false);
    }
  }, [jobId, remoteAnswerer, refreshSessions, sessionBusy]);

  /** Chuyển sang cửa sổ hội thoại hiện có. */
  const switchSession = useCallback(async (conversationId: string) => {
    const id = `${conversationId || ""}`.trim();
    const current =
      activeConversationIdRef.current
      || remoteAnswerer?.getConversationId?.()
      || "";
    if (!id || id === current || sessionBusy) return;

    // Cho phép chuyển đi khi đang tạo: thực sự abort yêu cầu đang chạy; nếu done của stream cũ tiếp tục, nó sẽ
    // gắn conversation_id trở lại hội thoại cũ và câu hỏi tiếp theo vào sai luồng (kiểm tra P0-4).
    runAbortRef.current?.abort();
    runAbortRef.current = null;
    runningRef.current = false;
    setIsRunning(false);

    // Chỉ cần cách ly ngắn; quá lâu sẽ giống "bấm không phản hồi / nhảy lung tung".
    armReaderAiClickShield(1200);
    lockReaderAiNavigation(1200);
    setSessionBusy(true);
    setSessionError("");
    const token = ++switchTokenRef.current;

    // Chuyển trạng thái chọn UI + xóa trước để tránh vẫn hiển thị nội dung hội thoại trước.
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

      // Căn snapshot cục bộ với server (cách ly theo hội thoại).
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

      // Chỉ cuộn panel AI, không đụng PDF.
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
        setSessionError("Không thể tải cuộc trò chuyện; hãy kiểm tra mạng rồi thử lại.");
        // Khi thất bại không giả vờ đã chuyển: khôi phục về rỗng để tránh hiển thị sai hội thoại.
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
   * "Mở hội thoại mới" từ một câu trả lời của trợ lý:
   * Sao chép lịch sử root → câu trả lời đó sang conversation mới, giữ nguyên hội thoại gốc.
   * Câu hỏi sau đó chỉ mang ngữ cảnh hội thoại mới, tránh ghi tiếp làm nhiễu luồng gốc (ChatGPT Branch in new chat).
   * @returns Có thành công hay không.
   */
  const branchFromAnswer = useCallback(async (assistantMessageId: string): Promise<boolean> => {
    const forkId = `${assistantMessageId || ""}`.trim();
    // Nếu xếp hàng khi busy thất bại phải có thông báo; vẫn có thể fork khi đang tạo (dừng running cục bộ trước).
    if (!forkId) {
      setSessionError("Không thể tạo nhánh: message id không hợp lệ.");
      return false;
    }
    if (sessionBusy) {
      setSessionError("Vui lòng chờ, một thao tác hội thoại đang được thực hiện.");
      return false;
    }
    if (runningRef.current) {
      runningRef.current = false;
      setIsRunning(false);
    }

    const path = pathForBranch(itemsRef.current, forkId, headIdRef.current);
    if (!path.length) {
      setSessionError("Không thể tạo nhánh: không tìm thấy đường hội thoại đến câu trả lời này.");
      return false;
    }
    const last = path[path.length - 1];
    if (last.message.role !== "assistant") {
      setSessionError("Chỉ có thể mở cuộc trò chuyện mới từ câu trả lời của trợ lý.");
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
        // Thử phân giải thêm một lần.
        try {
          docId = `${(await remoteAnswerer?.getDocumentId?.()) || ""}`.trim();
          documentIdRef.current = docId;
        } catch {
          docId = "";
        }
      }
      if (!docId) {
        setSessionError("Không thể tạo nhánh: tài liệu chưa sẵn sàng, vui lòng thử lại sau.");
        return false;
      }

      // Tuyến tính hóa parent để bảo đảm chuỗi cha con đầy đủ khi ghi fork (không phụ thuộc parentId cũ có thể bị đứt).
      const pathPayload = path.map((item, i) => ({
        id: item.message.id,
        role: item.message.role as "user" | "assistant",
        content: item.message.content,
        citations: item.message.citations,
        parentId: i === 0 ? null : path[i - 1].message.id,
      }));

      // Tiêu đề: fork-n-xxx (xxx = tên hội thoại hiện tại/gốc).
      const currentId =
        activeConversationIdRef.current
        || remoteAnswerer?.getConversationId?.()
        || "";
      const currentRow = (sessions || []).find((s) => s.conversation_id === currentId);
      const firstUser = pathPayload.find((p) => p.role === "user");
      const sourceTitle =
        `${currentRow?.title || ""}`.trim()
        || `${firstUser?.content || ""}`.replace(/\s+/g, " ").trim()
        || "Cuộc trò chuyện chưa đặt tên";
      const existingTitles = (sessions || []).map((s) => s.title || "");
      const branchTitle = nextForkConversationTitle(sourceTitle, existingTitles);

      // Phải fork đầy đủ lên server (gồm tin nhắn), không được chỉ tạo hội thoại rỗng.
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

      // Chuyển sang hội thoại mới; hội thoại gốc vẫn trong danh sách để chuyển lại.
      setItems(nextItems);
      setHeadId(nextHead);
      setActiveConversationId(nextConvId);
      activeConversationIdRef.current = nextConvId;
      remoteAnswerer?.setConversationId?.(nextConvId, docId);

      // Chèn lạc quan vào danh sách (với đúng tiêu đề và số tin nhắn), sau đó refresh để căn với server.
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

      // Hội thoại mới: cuộn xuống cuối để tiện hỏi tiếp.
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
      setSessionError("Tạo nhánh thất bại: không thể sao chép nội dung trước đó sang cuộc trò chuyện mới. Hãy kiểm tra mạng rồi thử lại.");
      return false;
    } finally {
      setSessionBusy(false);
    }
  }, [jobId, remoteAnswerer, refreshSessions, sessionBusy, sessions]);

  /** Xóa hội thoại (server + snapshot cục bộ); nếu xóa hội thoại hiện tại thì chuyển sang hội thoại gần nhất hoặc cửa sổ trống. */
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
      setSessionError("Không thể xóa cuộc trò chuyện, vui lòng thử lại.");
    } finally {
      if (token === switchTokenRef.current) setSessionBusy(false);
    }
  }, [applyConversationTree, jobId, remoteAnswerer, refreshSessions, sessionBusy]);

  /** Đổi tên tiêu đề hội thoại. */
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
      setSessionError("Đổi tên thất bại, vui lòng thử lại.");
    } finally {
      setSessionBusy(false);
    }
  }, [refreshSessions, sessionBusy]);

  // Sau khi hỏi đáp hoàn tất, làm mới tiêu đề/thứ tự danh sách hội thoại.
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
    // Khi đổi hội thoại/nhánh, không đặt isDisabled cho toàn luồng (trạng thái vô hiệu hóa chớp như làm mới); khóa phía nút bằng branchBusy.
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
      title: `${s.title || ""}`.trim() || "Cuộc trò chuyện chưa đặt tên",
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
