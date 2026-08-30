// Instance trạng thái đóng/mở CredentialsDialog dùng factory chung state/dialog-store.js.
// payload hiện chưa dùng; setupMode dùng trường riêng của credentials-view-store
// vì phải điều khiển nhiều chỗ như tiêu đề/nội dung lưu, không chỉ việc đóng/mở;
// giữ kênh payload để nhất quán với hợp đồng chung của dialog-store.js,
// sau này có thể mở kèm tham số trực tiếp mà không sửa factory.

import { createDialogStore } from "../../state/dialog-store.js";

export function createCredentialsDialogStore() {
  return createDialogStore();
}
