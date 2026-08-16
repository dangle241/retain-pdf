// Bản sao id hợp đồng DOM của hộp thoại Credentials/SettingsHub.
//
// Sao chép từ src/js/features/credentials/credentials-dom-contract.js; tên tệp này
// khớp regex chống hồi quy features/*dom-contract.js trong architecture-boundaries.test.mjs,
// dù nội dung chỉ là hằng id không logic; miền thẻ trạng thái 3b đã dùng cùng cách để sao chép
// status-card-dom-ids.js và tại đây làm tương tự, cùng
// src/js/components/dialogs/app-settings-dialog-contract.js (toàn thư mục thuộc
// lớp view phần tử tùy chỉnh cũ, cấm pages import). Giữ từng chuỗi id vì đường cơ sở hình ảnh và
// cổng kiểm tra xác nhận theo các id này; id mới không đổi tên chuỗi cũ.

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
    modelProvider: "browser-model-provider",
    modelBaseUrl: "browser-model-base-url",
    modelName: "browser-model-name",
    mathMode: "browser-job-math-mode",
    deepSeekValidateButton: "browser-deepseek-validate-btn",
    deepSeekTopUpLink: "browser-deepseek-top-up-link",
    deepSeekValidation: "browser-deepseek-validation",
  },
};

// Id của bảng/kiểm tra/ô token nhà cung cấp OCR đều ghép theo provider.id, phản chiếu quy tắc template cũ
// trong components/dialogs/browser-credentials-dialog.js.
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

// SettingsHubDialog (bản thiết kế §0.4, sao chép từ nguồn cũ).
// src/js/components/dialogs/app-settings-dialog-contract.js)。
export const APP_SETTINGS_DIALOG_IDS = {
  dialog: "app-settings-dialog",
  openButton: "app-settings-btn",
  closeButton: "app-settings-close-btn",
  /** Đã ngừng dùng (Cài đặt v2: vùng API nhúng CredentialsWorkbench, không có entry hộp thoại tầng hai).
   * Giữ hằng chỉ để đối chiếu lịch sử; không thêm nơi sử dụng mới. */
  credentialsButton: "credentials-btn",
  // Hai tab Thuật ngữ/Cập nhật chỉ là chỗ giữ chỗ ở giai đoạn này (bản thiết kế §0.4); đặt id trước để agent sau căn chỉnh.
  glossaryButton: "glossary-btn",
  appUpdateButton: "app-update-btn",
};

export const APP_SETTINGS_DIALOG_DATASETS = {
  settingsTab: "settingsTab",
  settingsPanel: "settingsPanel",
};
