// Thao tác "Dịch" của BookCard: mô-đun độc lập; sửa entry dịch chỉ đổi tệp này.
//
// Mặc định không thêm vào thẻ; bên gọi concat rõ ràng.
// Điều kiện hiển thị: tài liệu thư viện chưa dịch hoặc job thất bại, đồng thời có document_id + onTranslate.

import type { BookCardAction, BookCardActionHandlers, LibraryCardItem } from "../types.js";
import { isLibraryOnlyItem } from "../../../composition/external.js";

export const BOOK_CARD_ACTION_TRANSLATE = "translate";

/**
 * @param item Mục trên giá sách.
 * @param handlers onTranslate
 * @returns 0 hoặc 1 action.
 */
export function buildTranslateBookCardAction(
  item: LibraryCardItem = {},
  { onTranslate }: BookCardActionHandlers = {},
): BookCardAction[] {
  const documentId = `${item.document_id || ""}`.trim();
  if (!documentId || !onTranslate) {
    return [];
  }
  const canTranslate =
    isLibraryOnlyItem(item) || `${item.status || ""}`.trim() === "failed";
  if (!canTranslate) {
    return [];
  }

  return [{
    id: BOOK_CARD_ACTION_TRANSLATE,
    label: "Dịch",
    icon: "languages",
    className: "book-card-action book-card-action-translate",
    onClick: (_event, current) => {
      onTranslate?.(current);
    },
  }];
}
