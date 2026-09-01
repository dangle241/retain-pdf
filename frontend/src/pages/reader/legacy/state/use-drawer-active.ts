// drawer store â React subscription hook. store active is raw string (reference stable),
// can be fed directly to useSyncExternalStore (no app-framework/store snapshot clone pitfalls).

import { useSyncExternalStore } from "react";

export function useDrawerActive(drawerStore) {
  return useSyncExternalStore(
    drawerStore.subscribe,
    drawerStore.getActive,
    drawerStore.getActive,
  );
}
