// GlossariesDialog 的开合状态实例(state/dialog-store.js 通用工厂,镜像
// credentials-dialog-store.js)。payload 通道本域暂未使用,保留与通用契约
// 一致,便于未来"带参数打开"(例如从 developer 术语表下拉直接定位某条)。

import { createDialogStore } from "../../state/dialog-store.js";

export function createGlossariesDialogStore() {
  return createDialogStore();
}
