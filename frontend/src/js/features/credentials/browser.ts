import {
  getOcrProviderDefinition,
  normalizeOcrProvider,
  TRANSLATION_PROVIDER_DEFINITION,
} from "../../config/providers.js";
import {
  runOcrTokenValidation,
  type ProviderValidationResult,
} from "./validation.js";
import { handleBrowserDeepSeekValidate as runBrowserDeepSeekValidate } from "./deepseek-flow.js";
import {
  ocrTokenFromDialogValues,
  readCredentialDialogValues,
} from "./dialog-values.js";
import {
  defaultCredentialsStatePort,
} from "./default-state-port.js";
import { syncCredentialDialogFields } from "./dialog-sync.js";
import { ensureOcrCredentialValidationReady } from "./ocr-readiness-flow.js";
import {
  persistBrowserCredentialsFromDialog as persistBrowserCredentials,
  persistDesktopCredentialsFromDialog as persistDesktopCredentials,
} from "./persistence.js";
import { createCredentialRuntimeEnvPort } from "./runtime-env-port.js";
import { createCredentialUploadReadinessPort } from "./upload-readiness-port.js";
import { savePersistedBrowserStoredConfig } from "../../config/persisted-config.js";
import { notifyCredentialsChanged } from "../../reader/ai/config.js";
import type {
  CredentialsFields,
  CredentialsStatePort,
} from "./state.js";
import type {
  BindCredentialViewEventsOptions,
  OpenCredentialDialogOptions,
  UpdateCredentialGateViewOptions,
} from "./view.js";

export interface CredentialDialogElements {
  dialog?: HTMLDialogElement | HTMLElement | boolean | null;
  paddleInput?: HTMLInputElement | null;
  apiKeyInput?: HTMLInputElement | null;
  modelProviderSelect?: HTMLSelectElement | null;
  modelBaseUrlInput?: HTMLInputElement | null;
  modelNameInput?: HTMLInputElement | null;
  mathModeSelect?: HTMLSelectElement | null;
}

export interface CredentialDialogElementsPort {
  elements: () => CredentialDialogElements;
  syncOcrProviderControls?: (providerId?: string) => void;
}

export interface CredentialsViewPort {
  activateTab?: (tabName?: string) => void;
  bindEvents?: (handlers: BindCredentialViewEventsOptions) => void;
  closeDialog?: () => void;
  dialogElements?: () => CredentialDialogElements;
  openDialog?: () => void;
  setDeepSeekTopUpVisible?: (visible?: boolean) => void;
  setDeepSeekValidationMessage?: (message?: string, tone?: string) => void;
  setDialogMode?: (options?: {
    setupMode?: boolean;
    activateCredentialTab?: (tabName?: string) => void;
  }) => void;
  setDialogStatus?: (message?: string, tone?: string) => void;
  setHiddenOcrProvider?: (providerId?: string) => void;
  setOcrValidationMessage?: (message?: string, tone?: string, providerId?: string) => void;
  syncOcrProviderControls?: (providerId?: string) => void;
  updateCredentialGate?: (options?: UpdateCredentialGateViewOptions) => boolean | void;
}

export interface CredentialsRuntimeEnvPort {
  isDesktopMode?: () => boolean;
}

export interface CredentialsUploadStatePort {
  getSnapshot?: () => {
    uploadId?: string;
  };
}

export interface CredentialsBalanceStatePort {
  resetDeepSeekBalance?: () => void;
}

export interface CredentialsSetupModePort {
  currentSetupMode?: () => boolean;
}

export interface DeepSeekViewPort {
  elements?: () => CredentialDialogElements;
  setTopUpVisible?: (visible?: boolean) => void;
  setValidationMessage?: (message?: string, tone?: string) => void;
}

export interface OpenBrowserCredentialsDialogOptions {
  setupMode?: boolean;
}

export interface EnsureOcrCredentialsReadyOptions {
  onMissingToken?: () => void;
  onInvalidToken?: (result?: ProviderValidationResult | null) => void;
}

export interface UpdateCredentialGateOptions {
  workflowNeedsCredentials?: () => boolean;
  workflowNeedsUpload?: () => boolean;
  refreshSubmitControls?: () => void;
}

export interface RefreshDeepSeekBalanceOptions {
  silent?: boolean;
}

export interface MountBrowserCredentialsFeatureOptions {
  apiPrefix?: string;
  state?: unknown;
  applyHiddenCredentialInputs?: (credentials?: Partial<CredentialsFields> | unknown) => unknown;
  defaultPaddleToken?: () => string;
  defaultModelApiKey?: () => string;
  defaultModelBaseUrl?: () => string;
  getTaskOptions?: () => Record<string, unknown> | unknown;
  saveTaskOptions?: (options?: Record<string, unknown> | unknown) => unknown;
  saveBrowserStoredConfig?: (credentials?: CredentialsFields | Record<string, unknown> | unknown) => unknown;
  readHiddenCredentialInputs?: () => CredentialsFields | Record<string, unknown> | unknown;
  saveDesktopConfig?: (
    browserConfig?: Record<string, unknown> | unknown,
    afterSave?: () => unknown,
  ) => Promise<unknown> | unknown;
  checkApiConnectivity?: () => Promise<unknown> | unknown;
  validateOcrToken?: (
    apiPrefix?: unknown,
    providerId?: unknown,
    token?: unknown,
  ) => Promise<ProviderValidationResult | unknown> | ProviderValidationResult | unknown;
  validateDeepSeekToken?: (
    apiPrefix?: unknown,
    payload?: unknown,
  ) => Promise<ProviderValidationResult | unknown> | ProviderValidationResult | unknown;
  queryDeepSeekBalance?: (
    apiPrefix?: unknown,
    payload?: unknown,
  ) => Promise<ProviderValidationResult | unknown> | ProviderValidationResult | unknown;
  onCredentialStateChange?: () => void;
  uploadStatePort?: CredentialsUploadStatePort;
  credentialsStatePort?: CredentialsStatePort;
  runtimeEnvPort?: CredentialsRuntimeEnvPort;
  balanceStatePort?: CredentialsBalanceStatePort;
  legacyRuntimePort?: unknown;
  legacyValidationCachePort?: unknown;
  viewPort?: CredentialsViewPort;
  dialogElementsPort?: CredentialDialogElementsPort;
  deepSeekViewPort?: DeepSeekViewPort;
  setupModePort?: CredentialsSetupModePort;
}

function dialogDataset(dialog: CredentialDialogElements["dialog"]): DOMStringMap | undefined {
  if (dialog && typeof dialog === "object" && "dataset" in dialog) {
    return (dialog as HTMLElement).dataset;
  }
  return undefined;
}

export function mountBrowserCredentialsFeature({
  apiPrefix,
  state,
  applyHiddenCredentialInputs,
  defaultPaddleToken,
  defaultModelApiKey,
  defaultModelBaseUrl,
  getTaskOptions,
  saveTaskOptions,
  saveBrowserStoredConfig,
  readHiddenCredentialInputs,
  saveDesktopConfig,
  checkApiConnectivity,
  validateOcrToken,
  validateDeepSeekToken,
  queryDeepSeekBalance,
  onCredentialStateChange,
  uploadStatePort,
  credentialsStatePort = defaultCredentialsStatePort,
  runtimeEnvPort,
  balanceStatePort,
  legacyRuntimePort,
  legacyValidationCachePort,
  viewPort,
  dialogElementsPort,
  deepSeekViewPort = {
    elements: dialogElementsPort.elements,
    setTopUpVisible: viewPort.setDeepSeekTopUpVisible,
    setValidationMessage: viewPort.setDeepSeekValidationMessage,
  },
  setupModePort = {
    currentSetupMode: () => Boolean(dialogDataset(viewPort.dialogElements()?.dialog)?.setupMode === "1"),
  },
}: MountBrowserCredentialsFeatureOptions) {
  const uploadState = uploadStatePort || createCredentialUploadReadinessPort(state);
  const runtimeEnv = runtimeEnvPort || createCredentialRuntimeEnvPort(state);
  const balanceState = balanceStatePort || {
    resetDeepSeekBalance: () => credentialsStatePort.resetDeepSeekBalance?.(),
  };

  function readUploadState() {
    return uploadState.getSnapshot?.() || {};
  }

  function setCredentialDialogMode(setupMode = false) {
    viewPort.setDialogMode({ setupMode, activateCredentialTab });
  }

  function activateCredentialTab(tabName = "api") {
    viewPort.activateTab(tabName);
  }

  function currentOcrProvider() {
    return normalizeOcrProvider(credentialsStatePort.getCredentials?.().ocrProvider);
  }

  function syncOcrProviderControls(providerId = currentOcrProvider()) {
    const activeProvider = normalizeOcrProvider(providerId);
    viewPort.syncOcrProviderControls(activeProvider);
  }

  function readCurrentCredentials(): CredentialsFields {
    const current = credentialsStatePort.getCredentials?.();
    if (current) {
      return current;
    }
    const hidden = readHiddenCredentialInputs();
    const fields = hidden && typeof hidden === "object"
      ? hidden as Partial<CredentialsFields>
      : {};
    return {
      ocrProvider: normalizeOcrProvider(fields.ocrProvider),
      paddleToken: `${fields.paddleToken || ""}`.trim(),
      modelApiKey: `${fields.modelApiKey || ""}`.trim(),
    };
  }

  function syncBrowserDialogFromCredentialState() {
    syncCredentialDialogFields({
      credentials: readCurrentCredentials(),
      taskOptions: getTaskOptions?.() || {},
      defaultModelBaseUrl,
      defaultModelApiKey,
      elementsPort: dialogElementsPort,
    });
    viewPort.setOcrValidationMessage("", "", "paddle");
    viewPort.setDeepSeekValidationMessage("", "");
    viewPort.setDeepSeekTopUpVisible(false);
    balanceState.resetDeepSeekBalance();
    viewPort.setDialogStatus("", "");
  }

  function hasBrowserCredentials() {
    return Boolean(credentialsStatePort.hasComplete?.({
      defaultPaddleToken,
    }));
  }

  function openBrowserCredentialsDialog(options: OpenBrowserCredentialsDialogOptions = {}) {
    const { dialog } = viewPort.dialogElements();
    if (!dialog) {
      return;
    }
    syncBrowserDialogFromCredentialState();
    setCredentialDialogMode(!!options.setupMode);
    activateCredentialTab("api");
    viewPort.openDialog();
  }

  /**
   * Chế độ nhúng trong bảng cài đặt (khu API của SettingsHubDialog): chỉ "điền lại biểu mẫu từ trạng thái xác thực +
   * đặt lại về tab api", không qua viewPort.openDialog(); host của biểu mẫu là chính bảng cài đặt,
   * không có hộp thoại độc lập để mở. Cổng cấu hình đầu tiên (setupMode) vẫn dùng openBrowserCredentialsDialog.
   */
  function prepareCredentialsPanels() {
    syncBrowserDialogFromCredentialState();
    setCredentialDialogMode(false);
    activateCredentialTab("api");
  }

  async function ensureOcrCredentialsReady({
    onMissingToken,
    onInvalidToken,
  }: EnsureOcrCredentialsReadyOptions = {}) {
    const provider = currentOcrProvider();
    const readiness = await ensureOcrCredentialValidationReady({
      apiPrefix,
      state,
      providerId: provider,
      credentials: readCurrentCredentials(),
      defaultPaddleToken,
      validateOcrToken,
      setOcrValidationMessage: viewPort.setOcrValidationMessage,
      showResult: !runtimeEnv.isDesktopMode(),
      credentialsStatePort,
      legacyRuntimePort,
      legacyValidationCachePort,
    });
    if (readiness.status === "missing_token") {
      onMissingToken?.();
      viewPort.setOcrValidationMessage(readiness.definition.validationMissingMessage, "error", readiness.definition.id);
      return false;
    }
    if (readiness.ok) {
      return true;
    }
    onInvalidToken?.(readiness.result);
    return false;
  }

  function updateCredentialGate({
    workflowNeedsCredentials,
    workflowNeedsUpload,
    refreshSubmitControls,
  }: UpdateCredentialGateOptions) {
    const uploadEnabled = workflowNeedsUpload();
    const desktopMode = runtimeEnv.isDesktopMode();
    const uploadSnapshot = readUploadState();
    if (desktopMode) {
      if (!viewPort.updateCredentialGate({
        desktopMode: true,
        show: false,
        uploadEnabled,
        uploadReady: !!uploadSnapshot.uploadId,
      })) {
        return;
      }
      refreshSubmitControls();
      return;
    }
    const show = workflowNeedsCredentials() && !hasBrowserCredentials();
    if (!viewPort.updateCredentialGate({
      desktopMode: false,
      show,
      uploadEnabled,
      uploadReady: !!uploadSnapshot.uploadId,
    })) {
      return;
    }
    refreshSubmitControls();
  }

  async function handleBrowserOcrValidate() {
    const provider = currentOcrProvider();
    await runOcrTokenValidation({
      apiPrefix,
      state,
      providerId: provider,
      token: ocrTokenFromDialogValues(readCredentialDialogValues({ elementsPort: dialogElementsPort })),
      validateOcrToken,
      setOcrValidationMessage: viewPort.setOcrValidationMessage,
      showResult: true,
      credentialsStatePort,
      legacyRuntimePort,
    });
  }

  async function handleBrowserDeepSeekValidate() {
    await runBrowserDeepSeekValidate({
      apiPrefix,
      state,
      defaultModelApiKey,
      defaultModelBaseUrl,
      validateDeepSeekToken,
      queryDeepSeekBalance,
      onBalanceChange: onCredentialStateChange,
      credentialsStatePort,
      legacyRuntimePort,
      viewPort: deepSeekViewPort,
    });
  }

  async function refreshDeepSeekBalance({ silent = true }: RefreshDeepSeekBalanceOptions = {}) {
    return runBrowserDeepSeekValidate({
      apiPrefix,
      state,
      defaultModelApiKey,
      defaultModelBaseUrl,
      validateDeepSeekToken,
      queryDeepSeekBalance,
      onBalanceChange: onCredentialStateChange,
      silent,
      credentialsStatePort,
      legacyRuntimePort,
      viewPort: deepSeekViewPort,
    });
  }

  async function handleBrowserCredentialSave() {
    const definition = getOcrProviderDefinition(currentOcrProvider());
    const existing = readCurrentCredentials();
    const raw = readCredentialDialogValues({ elementsPort: dialogElementsPort });
    // Khi ô mật khẩu chưa được điền lại/bị xóa: chuỗi rỗng nghĩa là "giữ giá trị đã lưu", tránh ghi đè localStorage.
    const values = {
      ...raw,
      paddleToken: `${raw.paddleToken || ""}`.trim() || `${existing.paddleToken || ""}`.trim(),
      modelApiKey: `${raw.modelApiKey || ""}`.trim() || `${existing.modelApiKey || ""}`.trim(),
    };
    const ocrToken = ocrTokenFromDialogValues(values);
    const modelApiKey = `${values.modelApiKey || ""}`.trim();
    if (!ocrToken || !modelApiKey) {
      if (!ocrToken) {
        viewPort.setOcrValidationMessage(definition.validationMissingMessage, "error", definition.id);
      }
      if (!modelApiKey) {
        viewPort.setDeepSeekValidationMessage(TRANSLATION_PROVIDER_DEFINITION.validationMissingMessage, "error");
      }
      viewPort.setDialogStatus("Vui lòng nhập OCR Token và API Key của mô hình trước khi lưu", "error");
      return;
    }

    const nextCredentials = {
      ocrProvider: currentOcrProvider(),
      paddleToken: ocrToken,
      modelApiKey,
    };

    // Lưu chỉ ghi dữ liệu; việc kiểm tra qua mạng dành cho nút "Kiểm tra".
    // Phải await quá trình lưu bền vững đầy đủ (gồm desktop snapshot) rồi mới báo cổng AI làm mới.
    try {
      credentialsStatePort.setCredentials?.(nextCredentials);
      // Dùng thống nhất savePersisted*: ghi localStorage + desktop snapshot/IPC trong một lần.
      await savePersistedBrowserStoredConfig(nextCredentials);
      // Tương thích injection cũ (desktop markConfigured / tùy chọn tác vụ).
      if (runtimeEnv.isDesktopMode() && saveDesktopConfig) {
        await persistDesktopCredentials({
          currentOcrProvider,
          defaultModelApiKey,
          defaultModelBaseUrl,
          saveTaskOptions,
          saveDesktopConfig,
          checkApiConnectivity: async () => {
            try {
              await checkApiConnectivity?.();
            } catch {
              /* ignore connectivity on save */
            }
          },
          values: { ...values, paddleToken: ocrToken, modelApiKey },
          setupModePort,
        });
      } else {
        persistBrowserCredentials({
          applyCredentialInputs: applyHiddenCredentialInputs,
          currentOcrProvider,
          defaultModelApiKey,
          defaultModelBaseUrl,
          saveTaskOptions,
          saveBrowserStoredConfig,
          values: { ...values, paddleToken: ocrToken, modelApiKey },
        });
      }
      // Đảm bảo lại trạng thái trong bộ nhớ khớp với next vừa ghi.
      credentialsStatePort.setCredentials?.(nextCredentials);
    } catch (error) {
      const message = (error as { message?: string })?.message || String(error);
      viewPort.setDialogStatus(message, "error");
      viewPort.setDeepSeekValidationMessage(message, "error");
      return;
    }
    // Ghi lại vào ô nhập hiển thị để tránh ô vẫn trống sau khi lưu.
    syncBrowserDialogFromCredentialState();
    onCredentialStateChange?.();
    notifyCredentialsChanged();
    viewPort.setDialogStatus("Đã lưu", "valid");
    // Đóng hộp thoại cấu hình đầu tiên sau khi lưu; khi nhúng trong trung tâm cài đặt thì giữ mở để tiếp tục sửa tùy chọn tác vụ.
    if (setupModePort.currentSetupMode?.()) {
      viewPort.closeDialog();
    }
  }

  viewPort.bindEvents({
    resetPaddleValidation: () => {
      credentialsStatePort.resetOcrValidationCache?.();
      viewPort.setOcrValidationMessage("", "", "paddle");
    },
    resetDeepSeekValidation: () => {
      viewPort.setDeepSeekValidationMessage("", "");
      viewPort.setDeepSeekTopUpVisible(false);
      balanceState.resetDeepSeekBalance();
      onCredentialStateChange?.();
    },
    validateOcr: handleBrowserOcrValidate,
    validateDeepSeek: handleBrowserDeepSeekValidate,
    save: handleBrowserCredentialSave,
    open: openBrowserCredentialsDialog,
    activateCredentialTab,
    changeProvider: (event) => {
      const target = event.currentTarget as HTMLSelectElement | HTMLInputElement | null;
      const provider = normalizeOcrProvider(target?.value);
      credentialsStatePort.patchCredentials?.({ ocrProvider: provider });
      viewPort.setHiddenOcrProvider(provider);
      syncOcrProviderControls(provider);
    },
  });

  return {
    activateCredentialTab,
    ensureOcrCredentialsReady,
    hasBrowserCredentials,
    openBrowserCredentialsDialog,
    prepareCredentialsPanels,
    refreshDeepSeekBalance,
    setDialogStatus: viewPort.setDialogStatus,
    updateCredentialGate,
  };
}
