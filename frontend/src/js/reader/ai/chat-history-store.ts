// Multi-session persistence for reader QA: store per jobId in localStorage; one document can have multiple conversations.
// Each conversation stores two parts: messages (re-render bubbles when reopening Reader) + history (multi-turn context sent back to backend).
// Compatible with legacy single-session format ({messages, history}): auto-migrates to one session on first read.
//
// Two-layer external API:
//  - Single-session layer (backward compatible): load / save / clear operate on the current active session;
//  - Multi-session layer: listSessions / newSession / switchSession / deleteSession / activeSessionId.

import { summarizeSessions, trimSessions } from "./chat-sessions-view-model.js";

const STORAGE_PREFIX = "retainpdf-ai-chat-v1:";
const MAX_TURNS = 40;

function storageKey(jobId) {
  return `${STORAGE_PREFIX}${`${jobId || ""}`.trim()}`;
}

function nowMs() {
  try {
    return Date.now();
  } catch (_err) {
    return 0;
  }
}

function emptySession(id, createdAt) {
  return { id, title: "", createdAt, updatedAt: createdAt, messages: [], history: [] };
}

export function createReaderAiHistoryStore({
  jobId = "",
  storage = globalThis.localStorage || null,
} = {}) {
  const key = storageKey(jobId);
  const enabled = Boolean(`${jobId || ""}`.trim() && storage);
  let seq = 0;

  function newId() {
    seq += 1;
    return `s-${nowMs().toString(36)}-${seq}`;
  }

  // Read normalized multi-session data; swallow parse errors and migrate legacy format.
  function readData() {
    const blank = { activeId: "", sessions: [] };
    if (!enabled) {
      return blank;
    }
    let parsed = null;
    try {
      const raw = storage.getItem(key);
      parsed = raw ? JSON.parse(raw) : null;
    } catch (_err) {
      return blank;
    }
    if (!parsed || typeof parsed !== "object") {
      return blank;
    }
    // New format
    if (Array.isArray(parsed.sessions)) {
      const sessions = parsed.sessions.filter((item) => item && `${item.id || ""}`.trim());
      const activeId = sessions.some((item) => `${item.id}` === `${parsed.activeId}`)
        ? `${parsed.activeId}`
        : `${sessions[0]?.id || ""}`;
      return { activeId, sessions };
    }
    // Legacy single-session format: {messages, history} → migrate to one session
    if (Array.isArray(parsed.messages) || Array.isArray(parsed.history)) {
      const created = nowMs();
      const session = {
        ...emptySession(newId(), created),
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
        history: Array.isArray(parsed.history) ? parsed.history : [],
      };
      return { activeId: session.id, sessions: [session] };
    }
    return blank;
  }

  function writeData(data) {
    if (!enabled) {
      return;
    }
    try {
      const sessions = trimSessions(data);
      const activeId = sessions.some((item) => `${item.id}` === `${data.activeId}`)
        ? data.activeId
        : `${sessions[0]?.id || ""}`;
      storage.setItem(key, JSON.stringify({ v: 2, activeId, sessions }));
    } catch (_err) {
      // Quota full / private mode: silent failure, does not affect in-session usage
    }
  }

  // Get current active session; create empty one locally if missing (fallback before save/newSession).
  function ensureActive(data) {
    let active = data.sessions.find((item) => `${item.id}` === `${data.activeId}`);
    if (!active) {
      active = emptySession(newId(), nowMs());
      data.sessions.push(active);
      data.activeId = active.id;
    }
    return active;
  }

  // ===== Single-session layer (backward compatible) =====

  function load() {
    if (!enabled) {
      return { messages: [], history: [] };
    }
    const data = readData();
    const active = data.sessions.find((item) => `${item.id}` === `${data.activeId}`);
    return {
      messages: Array.isArray(active?.messages) ? active.messages : [],
      history: Array.isArray(active?.history) ? active.history : [],
    };
  }

  function save({ messages = [], history = [] } = {}) {
    if (!enabled) {
      return;
    }
    const data = readData();
    const active = ensureActive(data);
    // Truncate to limit: keep only recent turns per session to avoid unbounded localStorage growth
    active.messages = messages.slice(-MAX_TURNS);
    active.history = history.slice(-MAX_TURNS);
    active.updatedAt = nowMs();
    writeData(data);
  }

  // Clear current session content (session itself retained, title falls back to placeholder).
  function clear() {
    if (!enabled) {
      return;
    }
    const data = readData();
    const active = ensureActive(data);
    active.messages = [];
    active.history = [];
    active.title = "";
    active.updatedAt = nowMs();
    writeData(data);
  }

  // ===== Multi-session layer =====

  function listSessions() {
    if (!enabled) {
      return [];
    }
    return summarizeSessions(readData());
  }

  function activeSessionId() {
    if (!enabled) {
      return "";
    }
    return `${readData().activeId || ""}`;
  }

  // Create new empty session and set as active; return new session id.
  function newSession() {
    if (!enabled) {
      return "";
    }
    const data = readData();
    const session = emptySession(newId(), nowMs());
    data.sessions.push(session);
    data.activeId = session.id;
    writeData(data);
    return session.id;
  }

  // Switch active session; ignore if id does not exist. Returns that session's {messages, history}.
  function switchSession(id) {
    if (!enabled) {
      return { messages: [], history: [] };
    }
    const data = readData();
    if (data.sessions.some((item) => `${item.id}` === `${id}`)) {
      data.activeId = `${id}`;
      writeData(data);
    }
    return load();
  }

  // Delete specified session; if deleted was active, switch to most recently updated (or create empty if all gone).
  // Returns {messages, history} of the post-delete active session.
  function deleteSession(id) {
    if (!enabled) {
      return { messages: [], history: [] };
    }
    const data = readData();
    const target = `${id || data.activeId}`;
    data.sessions = data.sessions.filter((item) => `${item.id}` !== target);
    if (`${data.activeId}` === target) {
      const next = summarizeSessions(data)[0];
      data.activeId = next ? next.id : "";
    }
    if (!data.sessions.length) {
      const session = emptySession(newId(), nowMs());
      data.sessions.push(session);
      data.activeId = session.id;
    }
    writeData(data);
    return load();
  }

  return {
    load,
    save,
    clear,
    enabled,
    listSessions,
    activeSessionId,
    newSession,
    switchSession,
    deleteSession,
  };
}



