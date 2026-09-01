// CollectionManageDialog 的开合状态实例(state/dialog-store.js 通用工厂,镜像
// glossaries-dialog-store.js)。payload = 正在编辑的 CollectionRecord,或 null
// (新建模式)——open(collection) 传入即区分新建/编辑,不需要额外的 mode 字段。

import { createDialogStore } from "../../state/dialog-store.js";

export function createCollectionManageDialogStore() {
  return createDialogStore(null);
}
