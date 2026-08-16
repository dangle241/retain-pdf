// Instance trạng thái đóng/mở GlossariesDialog, dùng factory chung state/dialog-store.js và phản chiếu
// credentials-dialog-store.js. Miền này chưa dùng kênh payload nhưng giữ nhất quán với hợp đồng chung
// để sau này "mở kèm tham số", như định vị mục trực tiếp từ menu thuật ngữ developer.

import { createDialogStore } from "../../state/dialog-store.js";

export function createGlossariesDialogStore() {
  return createDialogStore();
}
