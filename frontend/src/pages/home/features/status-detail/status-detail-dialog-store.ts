// Instance trạng thái đóng/mở của StatusDetailDialog (dùng factory chung state/dialog-store.js,
// mục thứ hai trong danh sách "store mới" của thiết kế §1). Payload mang { activeTab }, open(tabName)
// và activateTab(tabName) đều gọi trực tiếp dialogStore.open({ activeTab });
// createDialogStore().open() chỉ hợp nhất payload khi trạng thái đã mở, không kích hoạt lại
// showModal (effect trong StatusDetailDialog.jsx chỉ gọi showModal khi open chuyển từ false → true),
// vì vậy "chỉ định tab khi mở" và "đổi tab sau khi mở" có thể dùng chung một phương thức.

import { createDialogStore, type DialogStore } from "../../state/dialog-store.js";

export type StatusDetailDialogPayload = {
  activeTab: string;
};

export type StatusDetailDialogStore = DialogStore<StatusDetailDialogPayload>;

export function createStatusDetailDialogStore(): StatusDetailDialogStore {
  return createDialogStore<StatusDetailDialogPayload>({ activeTab: "overview" });
}
