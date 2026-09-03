// Drawer store → React subscription hook. The store's active raw string (reference is stable),
// can be fed directly to useSyncExternalStore (no snapshot cloning pitfalls like in app-framework/store).

import { useSyncExternalStore } from "react";

export function useDrawerActive(drawerStore) {
  return useSyncExternalStore(
    drawerStore.subscribe,
    drawerStore.getActive,
    drawerStore.getActive,
  );
}


