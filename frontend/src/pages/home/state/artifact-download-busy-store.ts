// artifact-downloads busy-state store (dialogs blueprint §7.5 option 2).
//
// Background (blueprint §0.5): artifact-downloads are document-level delegated clicks
// + imperative setLinkBusy (legacy world mutates DOM text/class directly). The buttons
// are hosted in recent-jobs's ResultActions.jsx and the status-detail domain's
// StatusDetailDialog.jsx — both ancestors (StatusCard/StatusDetailDialog themselves)
// are wired into high-frequency polling/store-update chains. If a parent component
// re-renders due to unrelated field changes, the virtual DOM diff will erase the
// imperatively written "Downloading.../37%" text and revert the button to its original
// label. Option 2: setLinkBusy no longer touches the DOM, only writes to this store;
// each button subscribes to its own actionId slice (use-artifact-download-busy.js),
// the label comes entirely from React state, so re-renders won't overwrite it
// (since the state itself already holds the latest value).
//
// Relationship with the legacy src/js/features/artifact-downloads/download-view-port.js:
// the legacy file is kept untouched (still used by the not-yet-cutover dist/app.bundle.js
// where the default DOM version of setLinkBusy mutates the real <a> text) — composition.js
// mounts a separate viewPort instance for the React world, literally implementing the
// 3 methods (not importing the legacy view-port.js/view.js: both file names match the
// anti-rebound regex in architecture-boundaries.test.mjs, src/pages/** is forbidden from
// importing them), and setLinkBusy lands in this store.
//
// State shape: { [actionId]: { busy: true, label } }; absence of an actionId means
// the current state is not busy. getState() only swaps the top-level reference when
// something actually changes (same minimal pub-sub pattern as src/pages/home/state/dialog-store.js),
// so it can be fed directly into useSyncExternalStore without triggering unbounded
// re-renders (no getSnapshot cloning pitfall like app-framework/store.js).

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
    // useSyncExternalStore compatibility: subscribe returns an unsubscribe function
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getState: () => state,
    // Fetch a slice by actionId; if the same actionId is hit and unchanged, returns the same
    // object reference (setBusy on unrelated actionIds is a pure shallow spread, doesn't touch
    // other keys' value references) — combined with use-artifact-download-busy.js to achieve
    // button-level precise re-renders.
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



