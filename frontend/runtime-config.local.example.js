// Copy to runtime-config.local.js for local overrides.
// Do NOT put secrets here (modelApiKey / OCR tokens / X-API-Key).
// Fill those in the app: Settings → Credentials.
window.__FRONT_RUNTIME_CONFIG__ = {
  ...(window.__FRONT_RUNTIME_CONFIG__ || {}),
  // Rust API service root. Keep it at host:port level; do not append /api/v1.
  apiBase: "http://127.0.0.1:41000",
  // Leave empty; set via Settings → Credentials (or desktop config).
  xApiKey: "",
  ocrProvider: "paddle",
  mineruToken: "",
  paddleToken: "",
  modelApiKey: "",
  // Chỉ là preset ban đầu; người dùng có thể đổi Base URL và model trên giao diện.
  model: "gpt-4.1-mini",
  baseUrl: "https://api.openai.com/v1",
};
