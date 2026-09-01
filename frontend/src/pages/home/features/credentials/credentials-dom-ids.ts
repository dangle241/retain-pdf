// Credentials/SettingsHub Dialog DOM contract id copy.
//
// Copied from src/js/features/credentials/credentials-dom-contract.js(this filename
// Matches architecture-boundaries.test.mjs features/*dom-contract.js bounce prevention
// Regex, even if content has zero logic id constantsâ3b Status card field copied using same method.
// status-card-dom-ids.js, handle accordingly here and
// src/js/components/dialogs/app-settings-dialog-contract.js(This directory as a whole belongs to the old
// Custom element view layer, pages import forbidden). Preserve id strings individually, visual baseline and
// Gate checks based on these id assertions; never rename legacy strings for new ids.

export const CREDENTIAL_DOM_IDS = {
  dialog: "browser-credentials-dialog",
  trigger: "credentials-btn",
  gate: "credential-gate",
  gateAction: "credential-gate-action",
  file: "file",
  hidden: {
    ocrProvider: "ocr_provider",
    paddleToken: "paddle_token",
    modelApiKey: "api_key",
  },
  browser: {
    title: "browser-credentials-title",
    subtitle: "browser-credentials-subtitle",
    closeButton: "browser-credentials-close-btn",
    status: "browser-credentials-status",
    tabs: "browser-credentials-tabs",
    tabApi: "browser-credential-tab-api",
    tabTask: "browser-credential-tab-task",
    saveButton: "browser-credentials-save-btn",
    ocrProviderSelect: "browser-ocr-provider-select",
    apiKey: "browser-api-key",
    modelBaseUrl: "browser-model-base-url",
    modelName: "browser-model-name",
    mathMode: "browser-job-math-mode",
    deepSeekValidateButton: "browser-deepseek-validate-btn",
    deepSeekTopUpLink: "browser-deepseek-top-up-link",
    deepSeekValidation: "browser-deepseek-validation",
  },
};

// OCR provider panel/validation/token input id Select all provider.id concatenation(mirroring old
// components/dialogs/browser-credentials-dialog.js template concatenation rules)。
export function credentialTokenInputId(providerId = "") {
  return `browser-${providerId}-token`;
}

export function credentialValidateButtonId(providerId = "") {
  return `browser-${providerId}-validate-btn`;
}

export function credentialValidationId(providerId = "") {
  return `browser-${providerId}-validation`;
}

export const CREDENTIAL_DOM_DATASETS = {
  setupMode: "setupMode",
  credentialTab: "credentialTab",
  credentialPanel: "credentialPanel",
  ocrProviderPanel: "ocrProviderPanel",
};

// SettingsHubDialog(Blueprint Â§0.4, Copied from
// src/js/components/dialogs/app-settings-dialog-contract.js)。
export const APP_SETTINGS_DIALOG_IDS = {
  dialog: "app-settings-dialog",
  openButton: "app-settings-btn",
  closeButton: "app-settings-close-btn",
  /** Retired (settings v2：API Inline zone CredentialsWorkbenchNo second-layer popup entry
   *  Constant retained for historical reference only. Do not add new consumers. */
  credentialsButton: "credentials-btn",
// Glossary/Update both tab placeholder only.(Blueprint Â§0.4); implement id now for later use. agent alignment.
  glossaryButton: "glossary-btn",
  appUpdateButton: "app-update-btn",
};

export const APP_SETTINGS_DIALOG_DATASETS = {
  settingsTab: "settingsTab",
  settingsPanel: "settingsPanel",
};
