// Home page text registry (id → text) store.
//
// In the legacy world, ui/text.js's setText(id, value) is a global DOM write entry; in the React world
// it writes to this store, and components subscribed to the corresponding id render themselves.
// In stage 3a only error-box (inline-error-box) consumes it; ids from 3b domains like status-detail/job-runtime
// are parked in the store waiting for placeholder components to take over — so the setText callback
// interface stays stable for 3b.
//
// Special-case contract (mirrors ui/text.js): the value of "error-box" may be an error-diagnostic
// object; the display layer uses messageForErrorBox to extract the summary. Stored as-is here,
// interpreted by the component.

import { createStore, type Store } from "../../../js/app-framework/store.js";

/** Return shape of error-diagnostics.buildErrorDiagnostic */
export type ErrorDiagnosticText = {
  kind: "error-diagnostic";
  summary?: string;
  diagnostic?: string;
  [key: string]: unknown;
};

/**
 * Text slot value: plain string, error-box diagnostic object, or other display payloads.
 * Uses unknown to avoid any; ErrorDiagnosticText narrows for the display layer.
 */
export type HomeTextValue = unknown;

export type HomeTextState = {
  texts: Record<string, HomeTextValue>;
};

export type HomeTextActions = {
  set(
    currentState: HomeTextState,
    payload?: { id?: string; value?: HomeTextValue },
  ): HomeTextState;
};

export type HomeTextStore = Store<HomeTextState, HomeTextActions>;

export function createHomeTextStore() {
  const store = createStore<HomeTextState, HomeTextActions>({
    name: "homeTextRegistry",
    initialState: { texts: {} },
    actions: {
      set(currentState, { id, value } = {}) {
        if (!id) {
          return currentState;
        }
        return {
          ...currentState,
          texts: {
            ...currentState.texts,
            [id]: value,
          },
        };
      },
    },
  });

  function setText(id: string, value: HomeTextValue = undefined) {
    if (!id) {
      return;
    }
    store.actions.set({ id, value });
  }

  // Selector helper: used together with useStoreSnapshot(store, selector)
  function textOf(
    snapshot: HomeTextState | null | undefined,
    id: string,
    fallback: HomeTextValue = "",
  ): HomeTextValue {
    const value = snapshot?.texts?.[id];
    return value === undefined ? fallback : value;
  }

  return {
    setText,
    store,
    textOf,
  };
}



