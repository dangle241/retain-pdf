// general dialog open/close state factory (Blueprint Â§0.3) â CredentialsDialog/GlossariesDialog/
// AppUpdate details/SettingsHubDialog and other permanently mounted native <dialog> share the same semantics.
//
// Reference src/pages/reader/legacy/state/drawer-store.js mode (open/subscribe contract),
// Dialog is not "Mutually exclusive selection" but "Single toggle + Optional payload" (e.g., setupModeInitial tab),
// So the state shape is { open, payload } instead of drawer single active string.
//
// getState() Returned object reference only in open()/close() Update on call.(Not every read
// New), feed directly to useSyncExternalStore to avoid infinite re-renders
// No context. Empty input. app-framework/store.js getSnapshot clone pitfalls).

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
// useSyncExternalStore compatibility: subscribe returns unsubscribe function
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
