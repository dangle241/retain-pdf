// dialog-store (createDialogStore) → hook đăng ký React. Tham chiếu đối tượng state chỉ cập nhật khi
// open()/close(), cấp trực tiếp cho useSyncExternalStore (phản chiếu reader).
// use-drawer-active.js)。

import { useSyncExternalStore } from "react";
import type { DialogState, DialogStore } from "./dialog-store.js";

export function useDialogState<T = any>(dialogStore: DialogStore<T>): DialogState<T> {
  return useSyncExternalStore(
    dialogStore.subscribe,
    dialogStore.getState,
    dialogStore.getState,
  );
}
