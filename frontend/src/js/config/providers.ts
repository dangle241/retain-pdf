export const DEFAULT_OCR_PROVIDER = "paddle";

export const OCR_PROVIDER_DEFINITIONS = [
  {
    id: "paddle",
    label: "PaddleOCR",
    description: "Online OCR。",
    tokenField: "paddle_token",
    runtimeConfigKey: "paddleToken",
    tokenLabel: "Paddle Access Token",
    tokenPlaceholder: "Paddle Access Token",
validationButtonLabel: "Check Paddle",
    validationIdleMessage: "Not detected",
    validationMissingMessage: "Fill in first Paddle Access Token。",
    validationUnavailableMessage: "",
    docsUrl: "https://aistudio.baidu.com/account/accessToken",
    docsLabel: "Get Token",
    supportsValidation: true,
  },
];

export const TRANSLATION_PROVIDER_DEFINITION = {
  id: "deepseek",
  label: "DeepSeek",
  keyLabel: "DeepSeek Key",
  keyPlaceholder: "DeepSeek API Key",
  description: "Translate model.",
  docsUrl: "https://platform.deepseek.com/api_keys",
docsLabel: "Get Key",
validationButtonLabel: "Check DeepSeek",
validationIdleMessage: "Not checked",
validationMissingMessage: "Please fill in DeepSeek Key first.",
  validationSuccessMessage: "DeepSeek API connection successful.",
  validationNetworkMessage: "DeepSeek API check failed. Check network or browser CORS.",
  validationUnauthorizedMessage: "DeepSeek Key Invalid or expired.",
};

export function normalizeOcrProvider(value) {
  const provider = `${value || ""}`.trim().toLowerCase();
  return OCR_PROVIDER_DEFINITIONS.some((item) => item.id === provider) ? provider : DEFAULT_OCR_PROVIDER;
}

export function getOcrProviderDefinition(provider) {
  return OCR_PROVIDER_DEFINITIONS.find((item) => item.id === normalizeOcrProvider(provider)) || OCR_PROVIDER_DEFINITIONS[0];
}
