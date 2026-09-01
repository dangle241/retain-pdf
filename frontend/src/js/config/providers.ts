export const DEFAULT_OCR_PROVIDER = "paddle";

export const OCR_PROVIDER_DEFINITIONS = [
  {
    id: "paddle",
    label: "PaddleOCR",
    description: "Online OCR.",
    tokenField: "paddle_token",
    runtimeConfigKey: "paddleToken",
    tokenLabel: "Paddle Access Token",
    tokenPlaceholder: "Paddle Access Token",
    validationButtonLabel: "Check Paddle",
    validationIdleMessage: "Not checked",
    validationMissingMessage: "Enter the Paddle Access Token first.",
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
  description: "Translation model.",
  docsUrl: "https://platform.deepseek.com/api_keys",
  docsLabel: "Get Key",
  validationButtonLabel: "Check DeepSeek",
  validationIdleMessage: "Not checked",
  validationMissingMessage: "Enter the DeepSeek key first.",
  validationSuccessMessage: "DeepSeek API connected successfully.",
  validationNetworkMessage: "DeepSeek API check failed. Check the network or browser CORS restrictions.",
  validationUnauthorizedMessage: "DeepSeek key is invalid or expired.",
};

export function normalizeOcrProvider(value) {
  const provider = `${value || ""}`.trim().toLowerCase();
  return OCR_PROVIDER_DEFINITIONS.some((item) => item.id === provider) ? provider : DEFAULT_OCR_PROVIDER;
}

export function getOcrProviderDefinition(provider) {
  return OCR_PROVIDER_DEFINITIONS.find((item) => item.id === normalizeOcrProvider(provider)) || OCR_PROVIDER_DEFINITIONS[0];
}


