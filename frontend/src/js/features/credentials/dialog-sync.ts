import { normalizeOcrProvider } from "../../config/providers.js";
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
    modelBaseUrlInput,
    modelNameInput,
    mathModeSelect,
  } = elementsPort.elements();

  if (paddleInput) {
    paddleInput.value = credentials.paddleToken || "";
  }
  if (apiKeyInput) {
    // Only display keys already saved in settings, avoid backfilling from runtime (avoids "blank settings yet Q&A works")
    void defaultModelApiKey;
    apiKeyInput.value = `${credentials.modelApiKey || ""}`.trim();
  }
  if (modelBaseUrlInput) {
    modelBaseUrlInput.value = taskOptions.baseUrl || defaultModelBaseUrl?.() || "";
  }
  if (modelNameInput) {
    modelNameInput.value = taskOptions.model || "";
  }
  if (mathModeSelect) {
    mathModeSelect.value = taskOptions.mathMode === "placeholder" ? "placeholder" : "direct_typst";
  }
  elementsPort.syncOcrProviderControls(normalizeOcrProvider(credentials.ocrProvider));
}


