// Logic thuần quản lý nhiều hội thoại: suy ra tiêu đề, sắp xếp tóm tắt, cắt theo giới hạn.
// Không DOM, không storage để dễ unit test; store và bộ điều khiển chat dùng chung ngữ nghĩa.

import type {
  ReaderAiChatSession,
  ReaderAiSessionSummary,
  ReaderAiSessionsBag,
} from "../types.js";

export const MAX_SESSIONS = 20;
const TITLE_MAX = 18;

// Tiêu đề hội thoại: lấy thông điệp user đầu tiên, làm sạch khoảng trắng rồi cắt; nếu không có thì dùng chỗ giữ chỗ.
export function deriveSessionTitle(session: ReaderAiChatSession = {}) {
  const messages = Array.isArray(session?.messages) ? session.messages : [];
  const firstUser = messages.find(
    (item) => item?.role === "user" && `${item?.text || ""}`.trim(),
  );
  const raw = `${firstUser?.text || session?.title || ""}`.replace(/\s+/g, " ").trim();
  if (!raw) {
    return "Cuộc trò chuyện mới";
  }
  return raw.length > TITLE_MAX ? `${raw.slice(0, TITLE_MAX).trim()}…` : raw;
}

// Tóm tắt hội thoại: sắp updatedAt giảm dần, mới trước, đánh dấu active để kết xuất menu.
export function summarizeSessions({
  sessions = [],
  activeId = "",
}: ReaderAiSessionsBag = {}): ReaderAiSessionSummary[] {
  return (Array.isArray(sessions) ? sessions : [])
    .map((session) => ({
      id: `${session?.id || ""}`,
      title: deriveSessionTitle(session),
      updatedAt: Number(session?.updatedAt) || 0,
      messageCount: Array.isArray(session?.messages) ? session.messages.length : 0,
      active: `${session?.id || ""}` === `${activeId}`,
    }))
    .filter((summary) => summary.id)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

// Cắt theo giới hạn: giữ max hội thoại cập nhật gần nhất; luôn giữ active bằng cách loại mục cũ nhất.
export function trimSessions(
  { sessions = [], activeId = "" }: ReaderAiSessionsBag = {},
  max = MAX_SESSIONS,
): ReaderAiChatSession[] {
  const list = Array.isArray(sessions) ? [...sessions] : [];
  if (list.length <= max) {
    return list;
  }
  const sorted = list.sort(
    (a, b) => (Number(b?.updatedAt) || 0) - (Number(a?.updatedAt) || 0),
  );
  const kept = sorted.slice(0, max);
  if (activeId && !kept.some((session) => `${session?.id}` === `${activeId}`)) {
    const active = list.find((session) => `${session?.id}` === `${activeId}`);
    if (active) {
      kept[kept.length - 1] = active;
    }
  }
  return kept;
}
