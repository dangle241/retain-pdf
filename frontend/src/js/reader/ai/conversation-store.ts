// Cache cục bộ ID hội thoại AI trình đọc: dùng lại conversation_id theo job/document để hỗ trợ nhiều lượt.
// Nguồn thật vẫn là Rust ai_conversations; đây chỉ tạo liên kết phía client để tránh tạo hội thoại mới cho mỗi câu hỏi.

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
    // quota / private mode: bỏ qua; lượt hiện tại vẫn dùng trạng thái trong bộ nhớ.
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
