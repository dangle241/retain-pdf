// Trạng thái view thuần của CredentialsDialog (bản thiết kế §2: setupMode/tab/phản hồi kiểm tra/gợi ý nạp DeepSeek
// /trạng thái lưu) + viewPort/elementsPort dựa trên store nối với features/credentials/browser.js được giữ,
// được store điều khiển.
//
// browser-view-port.js/dialog-elements-port.js/view.js/dialog-sync.js/ cũ
// validation-view.js đều ghi DOM trực tiếp nên không import; tại đây triển khai lại chữ ký cùng tên,
// chỉ đổi đích "ghi" từ DOM sang store để các thành phần CredentialsDialog.jsx
// đăng ký và kết xuất. browser.js (bộ điều phối state.js/validation.js/deepseek-flow.js/
// ocr-readiness-flow.js/persistence.js/dialog-values.js và các lớp logic được giữ)
// được dùng lại không sửa dòng nào.

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
  /** { [providerId]: { message, tone } }: phản hồi kiểm tra OCR token như paddle. */
  validations: Record<string, CredentialsMessage>;
  deepSeek: CredentialsMessage;
  deepSeekTopUpVisible: boolean;
  dialogStatus: CredentialsMessage;
  /** Trạng thái chỉ đọc để HeroUpload đăng ký và quyết định khóa ô tải lên/hiển thị credential-gate. */
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
      // Trạng thái chỉ đọc để HeroUpload 3a đăng ký và quyết định khóa ô tải lên/hiển thị credential-gate.
      // (bản thiết kế §2.2 "chuyển trạng thái khóa nút upload sang 3a"); miền này chỉ ghi snapshot, không trực tiếp
      // chạm upload-view-store.js/HeroUpload.jsx.
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

  // Điểm thu thập DOM ref không kiểm soát cho trường hiển thị trong hộp thoại, phản chiếu
  // mẫu domRefs của upload-view-store.js. dialog-values.js/dialog-sync.js được giữ đọc/ghi trực tiếp
  // .value của các nút, không dùng value/onChange có kiểm soát của React để tránh hai nguồn ghi xung đột (rủi ro 1
  // trong bản thiết kế: dù trường hiển thị không phải bốn "input ẩn bridge", cũng không nên ghi kép).
  const elementsRef: CredentialsElementsRef = {
    apiKeyInput: null,
    modelProviderSelect: null,
    modelBaseUrlInput: null,
    modelNameInput: null,
    mathModeSelect: null,
    tokenInputs: {}, // { [providerId]: HTMLInputElement }
  };

  function elements() {
    return {
      paddleInput: elementsRef.tokenInputs.paddle || null,
      apiKeyInput: elementsRef.apiKeyInput,
      modelProviderSelect: elementsRef.modelProviderSelect,
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
    // Khả năng hiển thị bảng nhà cung cấp OCR do OcrProviderPanels.jsx đăng ký trực tiếp
    // credentialsStatePort(credentials.ocrProvider) để kết xuất; không cần
    // đồng bộ mệnh lệnh lần hai như dialog-sync.js cũ, nên no-op.
    syncOcrProviderControls: () => {},
  };

  // browser.js gọi đồng bộ một lần trong mountBrowserCredentialsFeature()
  // viewPort.bindEvents(handlers), chuyển save/validateOcr/validateDeepSeek/
  // changeProvider/activateCredentialTab/open và các hàm xử lý khác cho lớp view; trước đây
  // gắn listener DOM gốc ở đây bằng view.js cũ; React không có bước tương đương nên lưu
  // handlers vào ref và onClick của nút JSX gọi trực tiếp
  // (xem useCredentialsController.js).
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
      // no-op: credentialsStatePort.patchCredentials (singleton default-state-port.js)
      // đã ghi đồng bộ input ẩn qua tác dụng phụ mirrorToDom (xem handler
      // changeProvider trong browser.js); ghi lặp tại đây chỉ là cùng phép gán hai lần trong một khung.
    },
    setOcrValidationMessage: (message = "", tone = "", providerId = "") => store.actions.setValidation({
      providerId,
      message,
      tone,
    }),
    syncOcrProviderControls: () => {
      // no-op, cùng lý do với elementsPort.syncOcrProviderControls.
    },
    updateCredentialGate: (payload: Partial<CredentialGateState> = {}) => {
      store.actions.setCredentialGate(payload);
      return true; // browser.js dựa vào giá trị truthy để tiếp tục refreshSubmitControls().
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
