export const DEFAULT_OCR_PROVIDER = "paddle";

export const OCR_PROVIDER_DEFINITIONS = [
  {
    id: "paddle",
    label: "PaddleOCR",
    description: "OCR trực tuyến.",
    tokenField: "paddle_token",
    runtimeConfigKey: "paddleToken",
    tokenLabel: "Paddle Access Token",
    tokenPlaceholder: "Paddle Access Token",
    validationButtonLabel: "Kiểm tra Paddle",
    validationIdleMessage: "Chưa kiểm tra",
    validationMissingMessage: "Vui lòng nhập Paddle Access Token trước.",
    validationUnavailableMessage: "",
    docsUrl: "https://aistudio.baidu.com/account/accessToken",
    docsLabel: "Lấy Token",
    supportsValidation: true,
  },
];

export const TRANSLATION_PROVIDER_DEFINITION = {
  id: "translation-api",
  label: "API dịch",
  keyLabel: "API Key",
  keyPlaceholder: "API Key của mô hình",
  description: "API tương thích OpenAI.",
  validationButtonLabel: "Kiểm tra API",
  validationIdleMessage: "Chưa kiểm tra",
  validationMissingMessage: "Vui lòng nhập API Key của mô hình trước.",
  validationSuccessMessage: "Kết nối API mô hình thành công.",
  validationNetworkMessage: "Kiểm tra API mô hình thất bại; hãy kiểm tra Base URL, API Key và kết nối mạng.",
  validationUnauthorizedMessage: "API Key không hợp lệ hoặc đã hết hạn.",
};

export const TRANSLATION_PROVIDER_PRESETS = [
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    docsUrl: "https://platform.openai.com/api-keys",
    docsLabel: "OpenAI Key",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    docsUrl: "https://platform.deepseek.com/api_keys",
    docsLabel: "DeepSeek Key",
  },
  {
    id: "custom",
    label: "Tùy chỉnh",
    baseUrl: "",
    model: "",
    docsUrl: "",
    docsLabel: "",
  },
];

export function getTranslationProviderPreset(providerId = "") {
  const normalized = `${providerId || ""}`.trim().toLowerCase();
  return TRANSLATION_PROVIDER_PRESETS.find((item) => item.id === normalized)
    || TRANSLATION_PROVIDER_PRESETS.at(-1);
}

export function inferTranslationProvider(baseUrl = "") {
  const normalized = `${baseUrl || ""}`.trim().replace(/\/+$/, "").toLowerCase();
  const preset = TRANSLATION_PROVIDER_PRESETS.find((item) => (
    item.id !== "custom" && item.baseUrl.toLowerCase() === normalized
  ));
  return preset?.id || "custom";
}

export function isOfficialDeepSeekBaseUrl(baseUrl = "") {
  try {
    return new URL(`${baseUrl || ""}`.trim()).hostname.toLowerCase() === "api.deepseek.com";
  } catch {
    return false;
  }
}

export function normalizeOcrProvider(value) {
  const provider = `${value || ""}`.trim().toLowerCase();
  return OCR_PROVIDER_DEFINITIONS.some((item) => item.id === provider) ? provider : DEFAULT_OCR_PROVIDER;
}

export function getOcrProviderDefinition(provider) {
  return OCR_PROVIDER_DEFINITIONS.find((item) => item.id === normalizeOcrProvider(provider)) || OCR_PROVIDER_DEFINITIONS[0];
}
