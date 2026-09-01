// home Page text registry (id â copy) store.
//
// Legacy ui/text.js setText(id, value) Global DOM Sign in; React Change World
// Write to this store,Subscribed to corresponding id Component renders itself.3a Only stage error-box
// (inline-error-box) consumption; status-detail/job-runtime etc. 3b Domain id Apply
// store inside, placeholder components take over——setText Callback interface accordingly 3b Stay stable.
//
// Special-case convention (mirrors ui/text.js): "error-box" value allows error-diagnostic
// object,For presentation layer messageForErrorBox Extract summary;Store as-is.,Parsed by component.

import { createStore, type Store } from "../../../js/app-framework/store.js";

/** error-diagnostics.buildErrorDiagnostic Return shape */
export type ErrorDiagnosticText = {
  kind: "error-diagnostic";
  summary?: string;
  diagnostic?: string;
  [key: string]: unknown;
};

/**
 * Text slot value: plain string,error-box diagnostic object, or other display payloads.
* Use unknown to close, avoid any; ErrorDiagnosticText for presentation layer narrowing.
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

// selector helper function: use with useStoreSnapshot(store, selector)
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
