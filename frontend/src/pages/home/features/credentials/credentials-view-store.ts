// CredentialsDialog Pure view state â skipped: complex logic, add when dynamic behavior required.(Blueprint Â§2: setupMode/tab/Validation Feedback/DeepSeek Top Up
// prompt/Saved state)+ connected to features/credentials/browser.js(kept controller)
// store drives viewPort/elementsPort.
//
// Old world browser-view-port.js/dialog-elements-port.js/view.js/dialog-sync.js/
// validation-view.js are all direct DOM writes(dead, no import); same-name method signature here.
// Reimplement â skipped: detailed requirements, add when needed. Only change "write" destination from DOM to store to reduce CredentialsDialog.jsx code duplication. Refactor. Extract function.
// Component subscribes to render.browser.js(state.js/validation.js/deepseek-flow.js/
// ocr-readiness-flow.js/persistence.js/dialog-values.js etc. kept orchestrator of the logic layer)
// Reuse without changing a single line.

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
/** { [providerId]: { message, tone } } â OCR token validation feedback(paddle etc.) */
  validations: Record<string, CredentialsMessage>;
  deepSeek: CredentialsMessage;
  deepSeekTopUpVisible: boolean;
  dialogStatus: CredentialsMessage;
/** Read-only, for HeroUpload subscription to determine tile upload lock/credential-gate visibility */
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
// Read-only state, for 3a HeroUpload subscription to determine upload tile lock/credential-gate visibility
// (Blueprint Â§2.2 "upload Hand off button locked state 3a" â Write snapshot only in this domain, do not direct
      // touch upload-view-store.js/HeroUpload.jsx)。
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

// Uncontrolled visible fields in dialog DOM ref collection point(mirroring upload-view-store.js
// domRefs pattern). dialog-values.js/dialog-sync.js(kept) directly read and write these nodes'
// .value, no movement to React controlled value/onChange â avoid two write sources conflicting.(Blueprint Risk 1
// Sister issue: Visible fields aren't "hidden input bridges" for those 4, double-write unnecessary).
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
// OCR provider panel visibility controlled by OcrProviderPanels.jsx direct subscription
// credentialsStatePort(credentials.ocrProvider) rendering; not needed.
    // dialog-sync.js Original imperative secondary sync,no-op。
    syncOcrProviderControls: () => {},
  };

// browser.js in mountBrowserCredentialsFeature() call once synchronously
// viewPort.bindEvents(handlers), delegate save/validateOcr/validateDeepSeek/
// changeProvider/activateCredentialTab/open handlers to view layer. â Old world
// Mount native here. DOM Listen(view.js, dead); React has no equivalent steps in this world, change to
  // handlers Store ref,JSX button onClick Direct invocation
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
// no-op: credentialsStatePort.patchCredentials(default-state-port.js singleton)
// mirrorToDom side effects already written synchronously to hide input(see browser.js
      // changeProvider handler),Same-frame double assignment. Redundant.
    },
    setOcrValidationMessage: (message = "", tone = "", providerId = "") => store.actions.setValidation({
      providerId,
      message,
      tone,
    }),
    syncOcrProviderControls: () => {
      // no-op(Same reason. elementsPort.syncOcrProviderControls)。
    },
    updateCredentialGate: (payload: Partial<CredentialGateState> = {}) => {
      store.actions.setCredentialGate(payload);
      return true; // browser.js Continue based on truthiness evaluation. refreshSubmitControls()
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
