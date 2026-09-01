// drawer store → React 订阅 hook。store 的 active 是原始字符串(引用稳定),
// 直接喂 useSyncExternalStore 即可(不存在 app-framework/store 的快照克隆雷点)。

import { useSyncExternalStore } from "react";

export function useDrawerActive(drawerStore) {
  return useSyncExternalStore(
    drawerStore.subscribe,
    drawerStore.getActive,
    drawerStore.getActive,
  );
}
