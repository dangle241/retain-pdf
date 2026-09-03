// Generic dialog open/close state factory (blueprint §0.3) — CredentialsDialog/GlossariesDialog/
// AppUpdate details/SettingsHubDialog and other always-mounted native <dialog>s share the same semantics.
//
// Modeled after the pattern in src/pages/reader/legacy/state/drawer-store.js (open/subscribe contract),
// but a dialog is not "select one mutually exclusive" but "single open/close + optional payload"
// (setupMode, initial tab, etc.), so the state shape is { open, payload } instead of drawer's single active string.
//
// getState() returns an object reference that only updates on open()/close() calls (not a fresh one on every read),
// so it can be fed directly into useSyncExternalStore without triggering unbounded re-renders
// (no getSnapshot cloning pitfall like app-framework/store.js).

export type DialogState<T = unknown> = {
  open: boolean;
  payload: T;
};

export type DialogStore<T = unknown> = {
  subscribe: (listener: (state: DialogState<T>) => void) => () => void;
  getState: () => DialogState<T>;
  open: (payload?: T | null) => DialogState<T>;
  close: () => DialogState<T>;
};

export function createDialogStore<T = unknown>(initialPayload: T | null = null): DialogStore<T> {
  let state: DialogState<T> = { open: false, payload: initialPayload as T };
  const listeners = new Set<(state: DialogState<T>) => void>();

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
    open(payload = null) {
      state = { open: true, payload: payload === null ? state.payload : (payload as T) };
      notify();
      return state;
    },
    close() {
      if (!state.open) {
        return state;
      }
      state = { open: false, payload: state.payload };
      notify();
      return state;
    },
  };
}




