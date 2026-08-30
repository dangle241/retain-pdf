// Lưu bền vững nhiều hội thoại khi đọc: lưu localStorage theo jobId; một tài liệu có thể có nhiều cuộc trò chuyện.
// Mỗi hội thoại lưu hai phần: messages để kết xuất lại bong bóng khi mở lại trình đọc và history là ngữ cảnh nhiều lượt gửi về backend.
// Tương thích định dạng một hội thoại cũ ({messages, history}): tự di chuyển thành một hội thoại khi đọc lần đầu.
//
// API bên ngoài chia hai lớp:
//  - Lớp một hội thoại (tương thích ngược): load / save / clear tác động lên hội thoại active hiện tại;
//  - Lớp nhiều hội thoại: listSessions / newSession / switchSession / deleteSession / activeSessionId.

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

  // Đọc dữ liệu nhiều hội thoại đã chuẩn hóa; bỏ qua lỗi phân tích và di chuyển định dạng cũ.
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
    // Định dạng mới.
    if (Array.isArray(parsed.sessions)) {
      const sessions = parsed.sessions.filter((item) => item && `${item.id || ""}`.trim());
      const activeId = sessions.some((item) => `${item.id}` === `${parsed.activeId}`)
        ? `${parsed.activeId}`
        : `${sessions[0]?.id || ""}`;
      return { activeId, sessions };
    }
    // Định dạng cũ một hội thoại: {messages, history} → di chuyển thành một hội thoại.
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
      // Hết hạn mức/chế độ riêng tư: thất bại im lặng, không ảnh hưởng việc dùng trong phiên.
    }
  }

  // Lấy hội thoại active hiện tại; nếu không có thì tạo tại chỗ một hội thoại trống làm dự phòng trước save/newSession.
  function ensureActive(data) {
    let active = data.sessions.find((item) => `${item.id}` === `${data.activeId}`);
    if (!active) {
      active = emptySession(newId(), nowMs());
      data.sessions.push(active);
      data.activeId = active.id;
    }
    return active;
  }

  // ===== Lớp một hội thoại (tương thích ngược) =====

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
    // Cắt theo giới hạn: mỗi hội thoại chỉ giữ một số lượt gần nhất để localStorage không tăng vô hạn.
    active.messages = messages.slice(-MAX_TURNS);
    active.history = history.slice(-MAX_TURNS);
    active.updatedAt = nowMs();
    writeData(data);
  }

  // Xóa nội dung hội thoại hiện tại nhưng giữ hội thoại; tiêu đề lùi về chỗ giữ chỗ.
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

  // ===== Lớp nhiều hội thoại =====

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

  // Tạo hội thoại trống, đặt làm active và trả id hội thoại mới.
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

  // Chuyển hội thoại active; bỏ qua nếu id không tồn tại. Trả {messages, history} của hội thoại.
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

  // Xóa hội thoại chỉ định; nếu xóa active thì trỏ sang hội thoại cập nhật gần nhất, hoặc tạo hội thoại trống nếu đã xóa hết.
  // Trả {messages, history} của hội thoại active sau khi xóa.
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
