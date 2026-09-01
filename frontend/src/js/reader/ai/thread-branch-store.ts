// assistant-ui 分支树本地快照：按 job 存全量 parentId 树 + headId。
// 与 conversation-store（Rust conversation_id 粘性）互补；不进服务端。

import { loadStoredConversationId } from "./conversation-store.js";

const STORAGE_PREFIX = "retainpdf.reader.ai.thread-branch.v1:";

/** 与 answer-enhance / runtime 中的引用形状兼容；此处用宽松结构避免循环依赖。 */
export type ThreadBranchCitation = {
  ref?: number | string;
  block_id?: string;
  page_idx?: number;
  page?: number;
  job_id?: string;
  document_id?: string;
  snippet?: string;
  [key: string]: unknown;
};

export type ThreadBranchMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  progress?: string;
  citations?: ThreadBranchCitation[];
  status?: {
    type: string;
    reason?: string;
  };
};

export type ThreadBranchItem = {
  parentId: string | null;
  message: ThreadBranchMessage;
};

export type ThreadBranchSnapshot = {
  version: 1;
  headId: string | null;
  items: ThreadBranchItem[];
  /** 快照归属的会话 id（防串会话印章，审计 P2-10）；旧快照无此字段 */
  conversationId?: string;
};

export function threadBranchStorageKey(
  jobId: string,
  conversationId = "",
): string {
  const id = `${jobId || ""}`.trim();
  const conv = `${conversationId || ""}`.trim();
  if (conv) {
    return `${STORAGE_PREFIX}job:${id || "anonymous"}:conv:${conv}`;
  }
  return `${STORAGE_PREFIX}job:${id || "anonymous"}`;
}

function storage(): Storage | null {
  try {
    if (typeof globalThis.localStorage === "undefined") return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStatus(
  raw: unknown,
): ThreadBranchMessage["status"] | undefined {
  if (!isRecord(raw) || typeof raw.type !== "string") return undefined;
  const reason = typeof raw.reason === "string" ? raw.reason : undefined;
  return reason ? { type: raw.type, reason } : { type: raw.type };
}

function normalizeMessage(raw: unknown): ThreadBranchMessage | null {
  if (!isRecord(raw)) return null;
  const id = `${raw.id || ""}`.trim();
  const role = raw.role === "user" || raw.role === "assistant" ? raw.role : null;
  if (!id || !role) return null;
  const citations = Array.isArray(raw.citations)
    ? (raw.citations as ThreadBranchCitation[])
    : undefined;
  const progress = typeof raw.progress === "string" ? raw.progress : undefined;
  // 不恢复 running：刷新后不应卡在「生成中」
  let status = normalizeStatus(raw.status);
  if (status?.type === "running") {
    status = { type: "incomplete", reason: "cancelled" };
  }
  return {
    id,
    role,
    content: typeof raw.content === "string" ? raw.content : "",
    ...(progress ? { progress } : {}),
    ...(citations?.length ? { citations } : {}),
    ...(status ? { status } : {}),
  };
}

function normalizeSnapshot(raw: unknown): ThreadBranchSnapshot | null {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.items)) {
    return null;
  }
  const items: ThreadBranchItem[] = [];
  for (const entry of raw.items) {
    if (!isRecord(entry)) continue;
    const message = normalizeMessage(entry.message);
    if (!message) continue;
    const parentId =
      entry.parentId === null || entry.parentId === undefined
        ? null
        : `${entry.parentId}`.trim() || null;
    items.push({ parentId, message });
  }
  if (!items.length) return null;
  const headRaw = raw.headId;
  const headId =
    headRaw === null || headRaw === undefined
      ? items[items.length - 1]?.message.id ?? null
      : `${headRaw}`.trim() || null;
  const conversationId = `${(raw as { conversationId?: unknown }).conversationId || ""}`.trim();
  return { version: 1, headId, items, ...(conversationId ? { conversationId } : {}) };
}

export function loadThreadBranchSnapshot(
  jobId: string,
  conversationId = "",
): ThreadBranchSnapshot | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(threadBranchStorageKey(jobId, conversationId));
    if (!raw && conversationId) {
      // 兼容旧 key（仅 job）——但要防串会话（审计 P2-10）：
      // 1. 带 conversationId 印章的快照，归属不符直接拒绝；
      // 2. 无印章的真旧快照，只在"请求的正是本 job 的粘性会话"时才接受
      //    （旧快照写入时代唯一可能代表的就是它）。
      const legacy = store.getItem(threadBranchStorageKey(jobId));
      if (!legacy) return null;
      const snapshot = normalizeSnapshot(JSON.parse(legacy));
      if (!snapshot) return null;
      const marked = `${snapshot.conversationId || ""}`.trim();
      if (marked) {
        return marked === conversationId ? snapshot : null;
      }
      const sticky = loadStoredConversationId({ jobId });
      return sticky && sticky === conversationId ? snapshot : null;
    }
    if (!raw) return null;
    const snapshot = normalizeSnapshot(JSON.parse(raw));
    if (!snapshot) return null;
    const marked = `${snapshot.conversationId || ""}`.trim();
    if (marked && conversationId && marked !== conversationId) return null;
    return snapshot;
  } catch {
    return null;
  }
}

export function saveThreadBranchSnapshot(
  jobId: string,
  snapshot: ThreadBranchSnapshot,
  conversationId = "",
): void {
  const store = storage();
  if (!store) return;
  const id = `${jobId || ""}`.trim();
  if (!id || !snapshot.items.length) return;
  try {
    const payload: ThreadBranchSnapshot = {
      version: 1,
      headId: snapshot.headId,
      items: snapshot.items,
      ...(conversationId ? { conversationId } : {}),
    };
    store.setItem(
      threadBranchStorageKey(id, conversationId),
      JSON.stringify(payload),
    );
  } catch {
    // quota / private mode
  }
}

export function clearThreadBranchSnapshot(
  jobId: string,
  conversationId = "",
): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(threadBranchStorageKey(jobId, conversationId));
    if (!conversationId) {
      // 清 job 级旧 key
      store.removeItem(threadBranchStorageKey(jobId));
    }
  } catch {
    // ignore
  }
}

/** 可见路径：从 head 沿 parent 链回溯（parent 须先于 child 出现在 items 中）。 */
export function visiblePathFromSnapshot(
  snapshot: ThreadBranchSnapshot,
): ThreadBranchMessage[] {
  const byId = new Map(snapshot.items.map((i) => [i.message.id, i]));
  const head =
    (snapshot.headId && byId.get(snapshot.headId)) ||
    snapshot.items[snapshot.items.length - 1];
  if (!head) return [];
  const chain: ThreadBranchMessage[] = [];
  let cur: ThreadBranchItem | undefined = head;
  const guard = new Set<string>();
  while (cur && !guard.has(cur.message.id)) {
    guard.add(cur.message.id);
    chain.push(cur.message);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain.reverse();
}
