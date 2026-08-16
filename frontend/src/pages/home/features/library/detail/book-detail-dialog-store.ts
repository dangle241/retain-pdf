// Trạng thái đóng/mở hộp thoại chi tiết sách, tham khảo BookDetailModal của PDF_MD_lib.
// payload = mục thẻ lưới được bấm, gồm document_id / job_id / status /
// library_only / reading_status / tags và trường tức thời khác; hộp thoại lấy lại theo document_id
// tài liệu đầy đủ để bổ sung tác giả/năm/DOI/byte/ngày không có trên thẻ.
//
// Dùng lại createDialogStore({ open, payload }) chung, giống CollectionManageDialog.

import { createDialogStore } from "../../../state/dialog-store.js";
import type { LibraryCardItem } from "../types.js";

export function createBookDetailDialogStore() {
  return createDialogStore<LibraryCardItem | null>(null);
}
