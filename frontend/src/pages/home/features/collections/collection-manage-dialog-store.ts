// Instance trạng thái đóng/mở CollectionManageDialog (factory chung state/dialog-store.js, phản chiếu
// glossaries-dialog-store.js). payload = CollectionRecord đang sửa hoặc null
// (chế độ tạo mới); open(collection) phân biệt tạo/sửa, không cần trường mode thêm.

import { createDialogStore } from "../../state/dialog-store.js";

export function createCollectionManageDialogStore() {
  return createDialogStore(null);
}
