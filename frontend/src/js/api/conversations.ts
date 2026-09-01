// AI 会话 CRUD：对接 Rust /api/v1/ai/conversations（含 parent_id / head_id 分支树）。

import { API_PREFIX } from "../config/api-constants.js";
import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
import { buildApiEndpoint } from "./http.js";

export type ConversationRecord = {
  conversation_id: string;
  title: string;
  document_id?: string | null;
  created_at: string;
  updated_at: string;
  message_count?: number;
  head_id?: string;
};

export type MessageRecord = {
  message_id: string;
  conversation_id: string;
  seq: number;
  role: "user" | "assistant" | string;
  content: string;
  citations_json?: string;
  tool_trace_json?: string;
  model?: string;
  created_at: string;
  parent_id?: string;
};

export type ConversationDetail = ConversationRecord & {
  messages: MessageRecord[];
};

async function apiJson<T>(
  path: string,
  options: RequestInit = {},
  apiPrefix = API_PREFIX,
): Promise<T> {
  const url = path.startsWith("http")
    ? path
    : buildApiEndpoint(apiPrefix, path.replace(/^\//, ""));
  const headers = buildApiHeaders({
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  });
  const resp = await fetch(url, { ...options, headers });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(
      `${(body as { message?: string })?.message || resp.statusText || "request failed"}`,
    ) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }
  return unwrapEnvelope(body) as T;
}

export async function createConversation(
  payload: { title?: string; document_id?: string } = {},
  apiPrefix = API_PREFIX,
): Promise<ConversationRecord> {
  if (isMockMode()) {
    return {
      conversation_id: `mock-conv-${Date.now().toString(36)}`,
      title: payload.title || "",
      document_id: payload.document_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      message_count: 0,
      head_id: "",
    };
  }
  return apiJson<ConversationRecord>("ai/conversations", {
    method: "POST",
    body: JSON.stringify({
      title: payload.title || "",
      document_id: payload.document_id || "",
    }),
  }, apiPrefix);
}

export async function listConversations(
  query: { limit?: number; offset?: number; document_id?: string } = {},
  apiPrefix = API_PREFIX,
): Promise<{ conversations: ConversationRecord[] }> {
  if (isMockMode()) {
    return { conversations: [] };
  }
  const params = new URLSearchParams();
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.offset != null) params.set("offset", String(query.offset));
  if (query.document_id) params.set("document_id", query.document_id);
  const q = params.toString();
  return apiJson<{ conversations: ConversationRecord[] }>(
    `ai/conversations${q ? `?${q}` : ""}`,
    { method: "GET" },
    apiPrefix,
  );
}

export async function getConversation(
  conversationId: string,
  apiPrefix = API_PREFIX,
): Promise<ConversationDetail> {
  const id = `${conversationId || ""}`.trim();
  if (!id) {
    throw new Error("conversation_id required");
  }
  if (isMockMode()) {
    return {
      conversation_id: id,
      title: "",
      created_at: "",
      updated_at: "",
      message_count: 0,
      head_id: "",
      messages: [],
    };
  }
  return apiJson<ConversationDetail>(
    `ai/conversations/${encodeURIComponent(id)}`,
    { method: "GET" },
    apiPrefix,
  );
}

export async function deleteConversation(
  conversationId: string,
  apiPrefix = API_PREFIX,
): Promise<{ deleted: boolean }> {
  const id = `${conversationId || ""}`.trim();
  if (!id) {
    throw new Error("conversation_id required");
  }
  if (isMockMode()) {
    return { deleted: true };
  }
  return apiJson<{ deleted: boolean }>(
    `ai/conversations/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    apiPrefix,
  );
}

export async function patchConversation(
  conversationId: string,
  payload: { head_id?: string; title?: string },
  apiPrefix = API_PREFIX,
): Promise<ConversationRecord> {
  const id = `${conversationId || ""}`.trim();
  if (!id) {
    throw new Error("conversation_id required");
  }
  if (isMockMode()) {
    return {
      conversation_id: id,
      title: payload.title || "",
      created_at: "",
      updated_at: "",
      head_id: payload.head_id || "",
    };
  }
  // 只发有值的字段：空 head_id 不必带（旧服务/校验更稳）
  const body: Record<string, string> = {};
  const head = `${payload.head_id || ""}`.trim();
  const title = `${payload.title || ""}`.trim();
  if (head) body.head_id = head;
  if (title) body.title = title;
  if (!Object.keys(body).length) {
    throw new Error("patch requires head_id or title");
  }
  return apiJson<ConversationRecord>(
    `ai/conversations/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
    apiPrefix,
  );
}

export async function appendConversationMessage(
  conversationId: string,
  payload: {
    role: string;
    content: string;
    parent_id?: string;
    message_id?: string;
    citations_json?: string;
    tool_trace_json?: string;
    model?: string;
    set_head?: boolean;
  },
  apiPrefix = API_PREFIX,
): Promise<MessageRecord> {
  const id = `${conversationId || ""}`.trim();
  if (!id) {
    throw new Error("conversation_id required");
  }
  if (isMockMode()) {
    return {
      message_id: payload.message_id || `mock-msg-${Date.now().toString(36)}`,
      conversation_id: id,
      seq: 1,
      role: payload.role,
      content: payload.content,
      parent_id: payload.parent_id || "",
      created_at: new Date().toISOString(),
    };
  }
  return apiJson<MessageRecord>(
    `ai/conversations/${encodeURIComponent(id)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        role: payload.role,
        content: payload.content,
        parent_id: payload.parent_id || "",
        message_id: payload.message_id || "",
        citations_json: payload.citations_json || "",
        tool_trace_json: payload.tool_trace_json || "",
        model: payload.model || "",
        set_head: payload.set_head !== false,
      }),
    },
    apiPrefix,
  );
}

/** 去掉 fork-n- / 分支 · 前缀，得到原始对话名。 */
export function baseConversationTitle(title: string): string {
  let t = `${title || ""}`.replace(/\s+/g, " ").trim();
  if (!t) return "未命名对话";
  const fork = t.match(/^fork-\d+-(.+)$/i);
  if (fork?.[1]) t = fork[1].trim();
  t = t.replace(/^分支\s*[·•\-—]\s*/, "").trim();
  return t || "未命名对话";
}

/**
 * 生成 fork 标题：fork-n-xxx
 * n 为相对同一原始名已有 fork 的递增序号；xxx 为原对话名。
 */
export function nextForkConversationTitle(
  sourceTitle: string,
  existingTitles: string[] = [],
): string {
  const base = baseConversationTitle(sourceTitle);
  let maxN = 0;
  for (const raw of existingTitles) {
    const t = `${raw || ""}`.trim();
    const m = t.match(/^fork-(\d+)-(.+)$/i);
    if (!m) continue;
    if (baseConversationTitle(t) !== base) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > maxN) maxN = n;
  }
  const title = `fork-${maxN + 1}-${base}`;
  // DB/UI 标题不宜过长
  return title.length > 80 ? `${title.slice(0, 79).trim()}…` : title;
}

/**
 * 从答案处分叉成「新会话窗口」：
 * 把 root→fork 路径复制到新 conversation（新 message_id），原会话不动。
 */
export async function forkConversationFromPath(
  options: {
    documentId?: string;
    title?: string;
    path: Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      citations?: unknown[];
      parentId?: string | null;
    }>;
  },
  apiPrefix = API_PREFIX,
): Promise<{ conversation: ConversationRecord; items: ReturnType<typeof messagesToBranchItems> }> {
  const path = options.path || [];
  if (!path.length) {
    throw new Error("fork path empty");
  }
  const firstUser = path.find((m) => m.role === "user");
  const rawTitle = `${options.title || firstUser?.content || "未命名对话"}`.replace(/\s+/g, " ").trim();
  const title = rawTitle.length > 80 ? `${rawTitle.slice(0, 79).trim()}…` : rawTitle;

  const conversation = await createConversation(
    {
      title: title || "未命名对话",
      document_id: options.documentId || "",
    },
    apiPrefix,
  );
  const convId = conversation.conversation_id;

  // message_id 全局唯一，必须重映射
  const idMap = new Map<string, string>();
  const makeId = (role: string, i: number) =>
    `fork-${role[0] || "m"}-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 7)}`;

  path.forEach((m, i) => {
    idMap.set(m.id, makeId(m.role, i));
  });

  const items: ReturnType<typeof messagesToBranchItems> = [];
  for (let i = 0; i < path.length; i += 1) {
    const m = path[i];
    const newId = idMap.get(m.id)!;
    const parentRaw = m.parentId ? idMap.get(m.parentId) || "" : "";
    // 路径上若 parent 未映射（不应发生），按线性挂上一条
    const parentId =
      parentRaw
      || (i > 0 ? idMap.get(path[i - 1].id) || "" : "");

    let citations_json = "";
    if (m.citations?.length) {
      try {
        citations_json = JSON.stringify(m.citations);
      } catch {
        citations_json = "[]";
      }
    }

    await appendConversationMessage(
      convId,
      {
        role: m.role,
        content: m.content,
        message_id: newId,
        parent_id: parentId,
        citations_json,
        set_head: i === path.length - 1,
      },
      apiPrefix,
    );

    items.push({
      parentId: parentId || null,
      message: {
        id: newId,
        role: m.role,
        content: m.content,
        ...(m.citations?.length ? { citations: m.citations } : {}),
        ...(m.role === "assistant"
          ? { status: { type: "complete", reason: "stop" as const } }
          : {}),
      },
    });
  }

  return {
    conversation: {
      ...conversation,
      head_id: items[items.length - 1]?.message.id || "",
      message_count: items.length,
    },
    items,
  };
}

/** 服务端消息 → 前端分支树 items。 */
export function messagesToBranchItems(messages: MessageRecord[]): Array<{
  parentId: string | null;
  message: {
    id: string;
    role: "user" | "assistant";
    content: string;
    citations?: unknown[];
    status?: { type: string; reason?: string };
  };
}> {
  const items: Array<{
    parentId: string | null;
    message: {
      id: string;
      role: "user" | "assistant";
      content: string;
      citations?: unknown[];
      status?: { type: string; reason?: string };
    };
  }> = [];
  for (const m of messages) {
    const role = m.role === "user" || m.role === "assistant" ? m.role : null;
    if (!role) continue;
    let citations: unknown[] | undefined;
    try {
      const raw = JSON.parse(m.citations_json || "[]");
      if (Array.isArray(raw) && raw.length) citations = raw;
    } catch {
      // ignore
    }
    const parent = `${m.parent_id || ""}`.trim();
    items.push({
      parentId: parent || null,
      message: {
        id: m.message_id,
        role,
        content: m.content || "",
        ...(citations ? { citations } : {}),
        // assistant-ui: status 仅允许 assistant；user 带 status 会直接 throw
        ...(role === "assistant"
          ? { status: { type: "complete", reason: "stop" } }
          : {}),
      },
    });
  }
  return items;
}
