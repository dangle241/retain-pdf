// 阅读问答的多会话持久化:按 jobId 存 localStorage,一份文档可有多条对话。
// 每条会话存两部分:messages(重开阅读器时重渲染气泡)+ history(回传后端的多轮上下文)。
// 兼容旧版单会话格式({messages, history}):首次读取时自动迁移为一条会话。
//
// 对外接口分两层:
//  - 单会话层(向后兼容):load / save / clear 作用于当前 active 会话;
//  - 多会话层:listSessions / newSession / switchSession / deleteSession / activeSessionId。

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

  // 读出规范化的多会话数据;吞掉解析异常并迁移旧格式。
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
    // 新格式
    if (Array.isArray(parsed.sessions)) {
      const sessions = parsed.sessions.filter((item) => item && `${item.id || ""}`.trim());
      const activeId = sessions.some((item) => `${item.id}` === `${parsed.activeId}`)
        ? `${parsed.activeId}`
        : `${sessions[0]?.id || ""}`;
      return { activeId, sessions };
    }
    // 旧格式单会话:{messages, history} → 迁移为一条会话
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
      // 配额满/隐私模式:静默失败,不影响会话内使用
    }
  }

  // 取当前 active 会话;没有则就地补一条空会话(save/newSession 前的兜底)。
  function ensureActive(data) {
    let active = data.sessions.find((item) => `${item.id}` === `${data.activeId}`);
    if (!active) {
      active = emptySession(newId(), nowMs());
      data.sessions.push(active);
      data.activeId = active.id;
    }
    return active;
  }

  // ===== 单会话层(向后兼容) =====

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
    // 上限截断:每条会话只保留最近若干轮,避免 localStorage 无限增长
    active.messages = messages.slice(-MAX_TURNS);
    active.history = history.slice(-MAX_TURNS);
    active.updatedAt = nowMs();
    writeData(data);
  }

  // 清空当前会话内容(会话本身保留,标题回退占位)。
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

  // ===== 多会话层 =====

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

  // 新建空会话并置为 active,返回新会话 id。
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

  // 切换 active 会话;id 不存在则忽略。返回该会话的 {messages, history}。
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

  // 删除指定会话;删的是 active 时改指向最近更新的一条(全删光则补一条空会话)。
  // 返回删除后 active 会话的 {messages, history}。
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
