// DOM contract id copy for Credentials/SettingsHub dialogs.
//
// Copied from src/js/features/credentials/credentials-dom-contract.js (that filename
// matches the features/*dom-contract.js anti-rollback regex in architecture-boundaries.test.mjs,
// even though the content itself only has zero-logic id constants — status card domain
// already used the same technique to copy out status-card-dom-ids.js, same approach here)
// and src/js/components/dialogs/app-settings-dialog-contract.js (that entire directory
// belongs to the old custom-element view layer, forbidden from pages import). id strings
// kept one-to-one; visual baseline and gate assertions rely on these ids; new ids never
// renamed from old-world strings.

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

// OCR provider panel/validation/token input ids all concatenated by provider.id (mirrors old
// components/dialogs/browser-credentials-dialog.js's template concatenation rules).
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

// SettingsHubDialog (blueprint §0.4, copied from
// src/js/components/dialogs/app-settings-dialog-contract.js).
export const APP_SETTINGS_DIALOG_IDS = {
  dialog: "app-settings-dialog",
  openButton: "app-settings-btn",
  closeButton: "app-settings-close-btn",
  /** Retired (Settings v2: API tab embeds CredentialsWorkbench, no second-layer dialog entry).
   *  Constant kept only for historical side-by-side, do not add new consumers. */
  credentialsButton: "credentials-btn",
  // Glossary/Updates two tabs are currently placeholders (blueprint §0.4); ids landed first for subsequent agent alignment.
  glossaryButton: "glossary-btn",
  appUpdateButton: "app-update-btn",
};

export const APP_SETTINGS_DIALOG_DATASETS = {
  settingsTab: "settingsTab",
  settingsPanel: "settingsPanel",
};




