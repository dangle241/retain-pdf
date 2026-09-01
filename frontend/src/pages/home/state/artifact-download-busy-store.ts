// artifact-downloads busy state store (dialogs blueprint Â§7.5 Option 2).
//
// Background (blueprint Â§0.5): artifact-downloads uses document-level delegated clicks + imperative
// setLinkBusy (Modify old world directly. DOM text/class) Button hosts distributed across recent-jobs'
// ResultActions.jsx With this domain StatusDetailDialog.jsx——Common ancestor(StatusCard/
// StatusDetailDialog Itself)are all mounted on high-frequency polling/store Update Link,If the parent component during download
// Rerender on unrelated field change, virtual DOM diff writes imperatively. "Downloading.../37%" copy
// Accept, Reject label. Plan two:setLinkBusy no longer directly modify DOM,only write this store;
// Each button component subscribes to its own actionId slice (use-artifact-download-busy.js),
// label All from React state, re-render will not overwrite (because state is already up to date).
//
// Relationship with legacy world src/js/features/artifact-downloads/download-view-port.js:
// Keep legacy files unchanged. (Used by dist/app.bundle.js still pending cutover, default DOM version
// setLinkBusy directly modifies real <a> text)ââcomposition.js for React Duplicate world instance.
// viewPort Instance, literal direct implementation 3 Method (do not import legacy view-port.js/view.js:
// Both filenames match respectively architecture-boundaries.test.mjs Debounce regex.,
// src/pages/** Prohibit imports.),setLinkBusy Drop this store。
//
// state shape: { [actionId]: { busy: true, label } }; Absence of actionId indicates not current
// not busy. getState() swaps top-level ref only on actual change. (Same as
// src/pages/home/state/dialog-store.js same minimalist pub-sub),Feed directly
// useSyncExternalStore prevents infinite re-renders. (app-framework/store.js does not exist)
// getSnapshot pain points on each clone).

export type ArtifactBusySlice = {
  busy: boolean;
  label: string;
};

export type ArtifactDownloadBusyState = Record<string, ArtifactBusySlice>;

export type ArtifactDownloadBusyStore = {
  subscribe: (listener: (state: ArtifactDownloadBusyState) => void) => () => void;
  getState: () => ArtifactDownloadBusyState;
  getActionState: (actionId: string) => ArtifactBusySlice;
  setBusy: (actionId: string, busy: boolean, label?: string) => void;
  isBusy: (actionId: string) => boolean;
};

const IDLE: ArtifactBusySlice = Object.freeze({ busy: false, label: "" });

export function createArtifactDownloadBusyStore(): ArtifactDownloadBusyStore {
  let state: ArtifactDownloadBusyState = {};
  const listeners = new Set<(state: ArtifactDownloadBusyState) => void>();

  function notify() {
    listeners.forEach((listener) => listener(state));
  }

  return {
// useSyncExternalStore compatibility: subscribe returns unsubscribe function
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getState: () => state,
// Fetch shard by actionId; return same object if same actionId and unchanged.
// Reference (setBusy for unrelated actionId uses pure shallow spread, no other keys touched
    // Value reference)——cooperate use-artifact-download-busy.js Button-level precise re-rendering.
    getActionState(actionId) {
      return state[`${actionId || ""}`.trim()] || IDLE;
    },
    setBusy(actionId, busy, label = "") {
      const id = `${actionId || ""}`.trim();
      if (!id) {
        return;
      }
      if (!busy) {
        if (!(id in state)) {
          return;
        }
        const next = { ...state };
        delete next[id];
        state = next;
        notify();
        return;
      }
      state = { ...state, [id]: { busy: true, label: `${label || ""}` } };
      notify();
    },
    isBusy(actionId) {
      return Boolean(state[`${actionId || ""}`.trim()]?.busy);
    },
  };
}

export const ARTIFACT_DOWNLOAD_BUSY_IDLE = IDLE;
