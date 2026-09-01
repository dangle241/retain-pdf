// CredentialsDialog 的开合状态实例(用 state/dialog-store.js 通用工厂)。
// payload 目前未使用(setupMode 走 credentials-view-store 的独立字段,
// 因为它要驱动标题/保存文案等多处渲染,不只是"开合"这一件事);
// 保留 payload 通道是为了跟 dialog-store.js 的通用契约保持一致,
// 未来如需要"带参数打开"可以直接用,不必再改工厂函数。

import { createDialogStore } from "../../state/dialog-store.js";

export function createCredentialsDialogStore() {
  return createDialogStore();
}
