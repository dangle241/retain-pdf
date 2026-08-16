// Thao tác "Đọc nhanh" của BookCard: mô-đun độc lập; sửa logic đọc chỉ đổi tệp này.
//
// Hành vi:
// - Job hoàn tất → đọc đối chiếu (onReader(jobId))
// - Nếu chưa hoàn tất nhưng có document → đọc nguyên văn (onReadSource(documentId))
// - Lỗi và không có document → vẫn trả nút, bấm no-op để tương thích UI/test cũ

import type { BookCardAction, BookCardActionHandlers, LibraryCardItem } from "../types.js";

export const BOOK_CARD_ACTION_READ = "read";

/**
 * @param item Mục trên giá sách.
 * @param handlers onReader / onReadSource
 * @returns 0 hoặc 1 action (hiện luôn là 1).
 */
export function buildReadBookCardAction(
  item: LibraryCardItem = {},
  { onReader, onReadSource }: BookCardActionHandlers = {},
): BookCardAction[] {
  const documentId = `${item.document_id || ""}`.trim();
  const jobId = `${item.job_id || ""}`.trim();
  const readerAvailable = `${item.status || ""}`.trim() === "succeeded";

  let label = "Đọc bản gốc";
  let onClick: BookCardAction["onClick"] = () => {};

  if (readerAvailable && jobId) {
    label = "Đọc đối chiếu";
    onClick = () => {
      onReader?.(jobId);
    };
  } else if (documentId) {
    label = "Đọc bản gốc";
    onClick = () => {
      onReadSource?.(documentId);
    };
  }

  return [{
    id: BOOK_CARD_ACTION_READ,
    label,
    icon: "eye",
    // Điểm neo test cũ .recent-job-reader.
    className: "book-card-action book-card-action-read recent-job-reader",
    onClick,
  }];
}
