// BookCard"快速阅读"动作 —— 独立模块, 改阅读逻辑只动booksFiles.
//
// 行为:
// - Complete job → Side-by-side Reader (onReader(jobId))
// - no则有 document → Read Source (onReadSource(documentId))
// - Failed且None document → 仍返回按钮, 点击 no-op(兼容旧 UI/测试)

import type { BookCardAction, BookCardActionHandlers, LibraryCardItem } from "../types.js";

export const BOOK_CARD_ACTION_READ = "read";

/**
 * @param item 书架 item
 * @param handlers onReader / onReadSource
 * @returns 0 或 1 个 action(Current始终 1 个)
 */
export function buildReadBookCardAction(
  item: LibraryCardItem = {},
  { onReader, onReadSource }: BookCardActionHandlers = {},
): BookCardAction[] {
  const documentId = `${item.document_id || ""}`.trim();
  const jobId = `${item.job_id || ""}`.trim();
  const readerAvailable = `${item.status || ""}`.trim() === "succeeded";

  let label = "Read Source";
  let onClick: BookCardAction["onClick"] = () => {};

  if (readerAvailable && jobId) {
    label = "Side-by-side Reader";
    onClick = () => {
      onReader?.(jobId);
    };
  } else if (documentId) {
    label = "Read Source";
    onClick = () => {
      onReadSource?.(documentId);
    };
  }

  return [{
    id: BOOK_CARD_ACTION_READ,
    label,
    icon: "eye",
    // History测试锚点 .recent-job-reader
    className: "book-card-action book-card-action-read recent-job-reader",
    onClick,
  }];
}




