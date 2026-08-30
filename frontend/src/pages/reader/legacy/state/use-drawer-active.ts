// drawer store → hook đăng ký React. active của store là chuỗi nguyên thủy (tham chiếu ổn định),
// có thể cấp thẳng cho useSyncExternalStore (không có vấn đề clone snapshot của app-framework/store).

import { useSyncExternalStore } from "react";

export function useDrawerActive(drawerStore) {
  return useSyncExternalStore(
    drawerStore.subscribe,
    drawerStore.getActive,
    drawerStore.getActive,
  );
}
