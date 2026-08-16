import {
  inferTranslationProvider,
  normalizeOcrProvider,
} from "../../config/providers.js";
import { createCredentialDialogElementsPort } from "./dialog-elements-port.js";

export function syncCredentialDialogFields({
  credentials,
  taskOptions = {},
  defaultModelBaseUrl,
  defaultModelApiKey,
  elementsPort = createCredentialDialogElementsPort(),
}: any) {
  const {
    paddleInput,
    apiKeyInput,
    modelProviderSelect,
    modelBaseUrlInput,
    modelNameInput,
    mathModeSelect,
  } = elementsPort.elements();

  if (paddleInput) {
    paddleInput.value = credentials.paddleToken || "";
  }
  if (apiKeyInput) {
    // Chỉ hiển thị Key đã lưu trong cài đặt, không điền từ runtime (tránh tình trạng cài đặt trống nhưng vẫn hỏi đáp được).
    void defaultModelApiKey;
    apiKeyInput.value = `${credentials.modelApiKey || ""}`.trim();
  }
  if (modelBaseUrlInput) {
    modelBaseUrlInput.value = taskOptions.baseUrl || defaultModelBaseUrl?.() || "";
  }
  if (modelProviderSelect) {
    modelProviderSelect.value = inferTranslationProvider(modelBaseUrlInput?.value || taskOptions.baseUrl || "");
  }
  if (modelNameInput) {
    modelNameInput.value = taskOptions.model || "";
  }
  if (mathModeSelect) {
    mathModeSelect.value = taskOptions.mathMode === "placeholder" ? "placeholder" : "direct_typst";
  }
  elementsPort.syncOcrProviderControls(normalizeOcrProvider(credentials.ocrProvider));
}
