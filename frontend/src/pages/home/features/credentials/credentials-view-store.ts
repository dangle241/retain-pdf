// CredentialsDialog's pure view state (blueprint §2: setupMode/tab/validation
// feedback/DeepSeek top-up prompt/save state) + store-driven viewPort/elementsPort
// interfacing with features/credentials/browser.js (kept controller).
//
// Old world browser-view-port.js/dialog-elements-port.js/view.js/dialog-sync.js/
// validation-view.js all wrote directly to DOM (dead, not imported); here reimplemented
// with same method signatures, only the "write" destination changed from DOM to store,
// letting CredentialsDialog.jsx family components subscribe for rendering while browser.js
// (state.js/validation.js/deepseek-flow.js/ocr-readiness-flow.js/persistence.js/
// dialog-values.js etc., the kept logic layer's orchestrator) is reused without a single
// line changed.

import type { DialogStore } from "../../state/dialog-store.js";
import type {
  CredentialsElementsRef,
  HandlersBag,
} from "../../composition/types.js";
import { createStore } from "../../composition/external.js";
import type { Store } from "../../composition/external.js";

export type CredentialsMessage = {
  message: string;
  tone: string;
};

export type CredentialGateState = {
  desktopMode: boolean;
  show: boolean;
  uploadEnabled: boolean;
  uploadReady: boolean;
};

export type CredentialsViewState = {
  setupMode: boolean;
  activeTab: string;
  /** { [providerId]: { message, tone } } — OCR token validation feedback (paddle etc.) */
  validations: Record<string, CredentialsMessage>;
  deepSeek: CredentialsMessage;
  deepSeekTopUpVisible: boolean;
  dialogStatus: CredentialsMessage;
  /** Read-only state; subscribed to by HeroUpload to decide upload tile lock / credential-gate visibility */
  credentialGate: CredentialGateState;
};

export type CredentialsViewActions = {
  setSetupMode(state: CredentialsViewState, setupMode?: boolean): CredentialsViewState;
  setActiveTab(state: CredentialsViewState, tabName?: string): CredentialsViewState;
  setValidation(
    state: CredentialsViewState,
    payload?: { providerId?: string; message?: string; tone?: string },
  ): CredentialsViewState;
  setDeepSeek(
    state: CredentialsViewState,
    payload?: { message?: string; tone?: string },
  ): CredentialsViewState;
  setDeepSeekTopUpVisible(state: CredentialsViewState, visible?: boolean): CredentialsViewState;
  setDialogStatus(
    state: CredentialsViewState,
    payload?: { message?: string; tone?: string },
  ): CredentialsViewState;
  setCredentialGate(
    state: CredentialsViewState,
    payload?: Partial<CredentialGateState>,
  ): CredentialsViewState;
};

export type CredentialsViewStore = Store<CredentialsViewState, CredentialsViewActions>;

export function createCredentialsViewFeature({
  dialogStore,
}: {
  dialogStore: DialogStore;
}) {
  const store = createStore<CredentialsViewState, CredentialsViewActions>({
    name: "credentialsView",
    initialState: {
      setupMode: false,
      activeTab: "api",
      validations: {},
      deepSeek: { message: "", tone: "" },
      deepSeekTopUpVisible: false,
      dialogStatus: { message: "", tone: "" },
      // Read-only state; subscribed to by 3a HeroUpload to decide upload tile lock / credential-gate visibility
      // (blueprint §2.2 "upload button lock state transferred to 3a" — this domain only writes this snapshot, does not
      // directly touch upload-view-store.js/HeroUpload.jsx).
      credentialGate: {
        desktopMode: false,
        show: false,
        uploadEnabled: true,
        uploadReady: false,
      },
    },
    actions: {
      setSetupMode(currentState, setupMode = false) {
        return { ...currentState, setupMode: Boolean(setupMode) };
      },
      setActiveTab(currentState, tabName = "api") {
        return { ...currentState, activeTab: `${tabName || "api"}`.trim() || "api" };
      },
      setValidation(currentState, { providerId = "", message = "", tone = "" } = {}) {
        const id = `${providerId || ""}`.trim();
        if (!id) {
          return currentState;
        }
        return {
          ...currentState,
          validations: { ...currentState.validations, [id]: { message, tone } },
        };
      },
      setDeepSeek(currentState, { message = "", tone = "" } = {}) {
        return { ...currentState, deepSeek: { message, tone } };
      },
      setDeepSeekTopUpVisible(currentState, visible = false) {
        return { ...currentState, deepSeekTopUpVisible: Boolean(visible) };
      },
      setDialogStatus(currentState, { message = "", tone = "" } = {}) {
        return { ...currentState, dialogStatus: { message, tone } };
      },
      setCredentialGate(currentState, payload = {}) {
        return {
          ...currentState,
          credentialGate: { ...currentState.credentialGate, ...payload },
        };
      },
    },
  });

  // Uncontrolled DOM ref collection point for in-dialog visible fields (mirrors
  // upload-view-store.js's domRefs pattern). dialog-values.js/dialog-sync.js (kept)
  // directly read/write these nodes' .value, bypassing React controlled value/onChange —
// to avoid two write sources clashing (blueprint risk 1's sibling question: visible fields
  // are not the 4 "hidden input bridge" ones, but also should not be double-written).
  const elementsRef: CredentialsElementsRef = {
    apiKeyInput: null,
    modelBaseUrlInput: null,
    modelNameInput: null,
    mathModeSelect: null,
    tokenInputs: {}, // { [providerId]: HTMLInputElement }
  };

  function elements() {
    return {
      paddleInput: elementsRef.tokenInputs.paddle || null,
      apiKeyInput: elementsRef.apiKeyInput,
      modelBaseUrlInput: elementsRef.modelBaseUrlInput,
      modelNameInput: elementsRef.modelNameInput,
      mathModeSelect: elementsRef.mathModeSelect,
    };
  }

  function tokenInputRef(providerId: string) {
    return (node: HTMLInputElement | null) => {
      elementsRef.tokenInputs[providerId] = node || null;
    };
  }

  const elementsPort = {
    elements,
    // OCR provider panel visibility subscribed to directly by OcrProviderPanels.jsx
    // via credentialsStatePort (credentials.ocrProvider) rendering; no required
    // dialog-sync.js-style imperative second sync, no-op.
    syncOcrProviderControls: () => {},
  };

  // browser.js calls viewPort.bindEvents(handlers) once synchronously inside
  // mountBrowserCredentialsFeature(), handing save/validateOcr/validateDeepSeek/
  // changeProvider/activateCredentialTab/open handlers to the view layer — old world
  // attached native DOM listeners here (view.js, dead); React world has no equivalent
  // step, changed to storing handlers in a ref, JSX buttons' onClick call directly
  // (see useCredentialsController.js).
  const handlersRef: { current: HandlersBag | null } = { current: null };

  const viewPort = {
    activateTab: (tabName = "api") => store.actions.setActiveTab(tabName),
    bindEvents: (handlers: HandlersBag) => {
      handlersRef.current = handlers;
    },
    closeDialog: () => dialogStore.close(),
    dialogElements: () => ({ dialog: true, ...elements() }),
    openDialog: () => dialogStore.open(),
    setDeepSeekTopUpVisible: (visible = false) => store.actions.setDeepSeekTopUpVisible(visible),
    setDeepSeekValidationMessage: (message = "", tone = "") => store.actions.setDeepSeek({ message, tone }),
    setDialogMode: ({
      setupMode = false,
      activateCredentialTab,
    }: {
      setupMode?: boolean;
      activateCredentialTab?: (tab: string) => void;
    } = {}) => {
      store.actions.setSetupMode(setupMode);
      if (setupMode) {
        activateCredentialTab?.("api");
      }
    },
    setDialogStatus: (message = "", tone = "") => store.actions.setDialogStatus({ message, tone }),
    setHiddenOcrProvider: () => {
      // no-op: credentialsStatePort.patchCredentials (default-state-port.js singleton)
      // mirrorToDom side effect has already synchronously written the hidden input (see browser.js's
      // changeProvider handler); writing again here would be two identical assignments in the same frame.
    },
    setOcrValidationMessage: (message = "", tone = "", providerId = "") => store.actions.setValidation({
      providerId,
      message,
      tone,
    }),
    syncOcrProviderControls: () => {
      // no-op (same reason as elementsPort.syncOcrProviderControls).
    },
    updateCredentialGate: (payload: Partial<CredentialGateState> = {}) => {
      store.actions.setCredentialGate(payload);
      return true; // browser.js depends on truthy return to continue refreshSubmitControls()
    },
  };

  return {
    store,
    elementsPort,
    elementsRef,
    handlersRef,
    tokenInputRef,
    viewPort,
  };
}




