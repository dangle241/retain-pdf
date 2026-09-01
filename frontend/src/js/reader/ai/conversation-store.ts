// 阅读器 AI 会话 ID 本地缓存:按 job / document 复用 conversation_id,实现多轮。
// 真源仍是 Rust ai_conversations;这里只做客户端粘性,避免每问新建会话。

const STORAGE_PREFIX = "retainpdf.reader.ai.conversation.v1:";

export type ConversationScopeKey = {
  jobId?: string;
  documentId?: string;
};

export function conversationStorageKey(scope: ConversationScopeKey = {}): string {
  const jobId = `${scope.jobId || ""}`.trim();
  const documentId = `${scope.documentId || ""}`.trim();
  if (jobId) {
    return `${STORAGE_PREFIX}job:${jobId}`;
  }
  if (documentId) {
    return `${STORAGE_PREFIX}doc:${documentId}`;
  }
  return `${STORAGE_PREFIX}anonymous`;
}

function storage(): Storage | null {
  try {
    if (typeof globalThis.localStorage === "undefined") {
      return null;
    }
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function loadStoredConversationId(scope: ConversationScopeKey = {}): string {
  const store = storage();
  if (!store) {
    return "";
  }
  try {
    return `${store.getItem(conversationStorageKey(scope)) || ""}`.trim();
  } catch {
    return "";
  }
}

export function saveStoredConversationId(
  scope: ConversationScopeKey,
  conversationId: string,
): void {
  const id = `${conversationId || ""}`.trim();
  const store = storage();
  if (!store || !id) {
    return;
  }
  try {
    store.setItem(conversationStorageKey(scope), id);
  } catch {
    // quota / private mode — 忽略,本轮仍可用内存态
  }
}

export function clearStoredConversationId(scope: ConversationScopeKey = {}): void {
  const store = storage();
  if (!store) {
    return;
  }
  try {
    store.removeItem(conversationStorageKey(scope));
  } catch {
    // ignore
  }
}
