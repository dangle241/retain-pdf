// dialog-store(createDialogStore) â React subscription hook. state object reference only
// open()/close() update timestamp, feed directly. useSyncExternalStore (mirrors reader's
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
