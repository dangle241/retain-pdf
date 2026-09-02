// artifact-download-busy-store.js → React subscription hook, fetches a slice by actionId
// (blueprint §7.5 option 2 core mechanism). getSnapshot is memoized via useCallback, only changing
// function identity when store/actionId changes; store.getActionState(actionId) returns the same
// object reference when that actionId is unchanged (the IDLE constant or an unmodified busy slice),
// working with useSyncExternalStore to achieve "only my own actionId change triggers a re-render",
// avoiding overwriting or jitter from high-frequency polling re-renders triggered by ancestors
// (StatusCard/StatusDetailDialog).

import { useCallback, useSyncExternalStore } from "react";
import type { ArtifactBusySlice, ArtifactDownloadBusyStore } from "./artifact-download-busy-store.js";

export function useArtifactDownloadBusy(
  store: ArtifactDownloadBusyStore,
  actionId: string,
): ArtifactBusySlice {
  const getSnapshot = useCallback(() => store.getActionState(actionId), [store, actionId]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

