import {
  buildBrowserCredentialConfig,
  buildTaskOptionsFromDialogValues,
} from "./dialog-values.js";
import { createCredentialSetupModePort } from "./setup-mode-port.js";

export function persistBrowserCredentialsFromDialog({
  applyHiddenCredentialInputs,
  applyCredentialInputs = applyHiddenCredentialInputs,
  currentOcrProvider,
  defaultModelApiKey,
  defaultModelBaseUrl,
  readHiddenCredentialInputs: _readHiddenCredentialInputs,
  readCredentialInputs: _readCredentialInputs,
  saveTaskOptions,
  saveBrowserStoredConfig,
  values,
}: any) {
  // Persist form results directly; avoid re-fetching. state/DOM Read-back yields stale value.
  const next = buildBrowserCredentialConfig({
    values,
    currentOcrProvider,
    defaultModelApiKey,
  });
  applyCredentialInputs(next);
  saveBrowserStoredConfig?.(next);
  saveTaskOptions?.(buildTaskOptionsFromDialogValues({
    values,
    defaultModelBaseUrl,
  }));
  return next;
}

export async function persistDesktopCredentialsFromDialog({
  currentOcrProvider,
  defaultModelApiKey,
  defaultModelBaseUrl,
  saveTaskOptions,
  saveDesktopConfig,
  checkApiConnectivity,
  values,
  setupModePort = createCredentialSetupModePort(),
}: any) {
  const provider = currentOcrProvider();
  const paddleToken = values.paddleToken;
// Match browser: store only user settings input key, do not silently backfill from runtime.
  void defaultModelApiKey;
  const modelApiKey = `${values.modelApiKey || ""}`.trim();
  await saveDesktopConfig?.(
    {
      ocrProvider: provider,
      paddleToken,
      modelApiKey,
      markConfigured: setupModePort.currentSetupMode(),
    },
    async () => {
      await checkApiConnectivity?.();
    },
  );
  saveTaskOptions?.(buildTaskOptionsFromDialogValues({
    values,
    defaultModelBaseUrl,
  }));
}
