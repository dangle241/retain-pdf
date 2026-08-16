// Instance trạng thái đóng/mở của SettingsHubDialog (factory dùng chung state/dialog-store.js).
// Payload chứa "tab cần kích hoạt khi mở" (api/glossary/update), mặc định là "api".

import { createDialogStore } from "../../state/dialog-store.js";

export function createSettingsHubDialogStore() {
  return createDialogStore({ tab: "api" });
}
