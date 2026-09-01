// artifact-download-busy-store.js â React subscription hook, slice by actionId.
// (Blueprint Â§7.5 Option 2 core mechanism). getSnapshot cached via useCallback, only when
// store/actionId Swap function identity on change.;store.getActionState(actionId) Incomplete input. Provide full source text.
// actionId returns same object reference when unchanged. (IDLE constant or unchanged busy shard),
// With useSyncExternalStore: "Own only. actionId re-renders only on change.",
// Not inherited(StatusCard/StatusDetailDialog)overwritten or jittered by high-frequency polling re-renders.

import { useCallback, useSyncExternalStore } from "react";
import type { ArtifactBusySlice, ArtifactDownloadBusyStore } from "./artifact-download-busy-store.js";

export function useArtifactDownloadBusy(
  store: ArtifactDownloadBusyStore,
  actionId: string,
): ArtifactBusySlice {
  const getSnapshot = useCallback(() => store.getActionState(actionId), [store, actionId]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
