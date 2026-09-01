// Reader AI session ID Local cache: reuse conversation_id by job / document for multi-turn.
// True source remains Rust ai_conversations;Client-side stickiness only.,Avoid creating new session for every query.

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
// quota / private mode â ignore. In-memory state still usable this round
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
