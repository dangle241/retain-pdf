// GlossariesDialog 的开合Status实例(state/dialog-store.js 通用工厂,镜像
// credentials-dialog-store.js).payload 通道books域暂未使用,保留与通用契约
// 一致,便于未来"带参数打开"(例如从 developer Glossary下拉直接Locate某entries).

import { createDialogStore } from "../../state/dialog-store.js";

export function createGlossariesDialogStore() {
  return createDialogStore();
}



