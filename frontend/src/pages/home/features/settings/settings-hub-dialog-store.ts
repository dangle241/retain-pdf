// SettingsHubDialog 的开合状态实例(state/dialog-store.js 通用工厂)。
// payload 承载"打开时激活哪个 tab"(api/glossary/update),默认 "api"。

import { createDialogStore } from "../../state/dialog-store.js";

export function createSettingsHubDialogStore() {
  return createDialogStore({ tab: "api" });
}
