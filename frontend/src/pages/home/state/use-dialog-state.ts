// dialog-store (createDialogStore) → React subscription hook. The state object reference only
// updates on open()/close(), so it can be fed directly into useSyncExternalStore (mirrors reader's use-drawer-active.js).

import { useSyncExternalStore } from "react";
import type { DialogState, DialogStore } from "./dialog-store.js";

export function useDialogState<T = any>(dialogStore: DialogStore<T>): DialogState<T> {
  return useSyncExternalStore(
    dialogStore.subscribe,
    dialogStore.getState,
    dialogStore.getState,
  );
}

