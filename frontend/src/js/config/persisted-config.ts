import {
  isDesktopMode,
  persistedDesktopSnapshot,
  savePersistedBrowserConfig,
  savePersistedDeveloperConfig,
} from "./desktop-persistence.js";
import {
  normalizeBrowserStoredConfig,
  normalizeDeveloperStoredConfig,
  readBrowserStoredConfig,
  readDeveloperStoredConfig,
  writeBrowserStoredConfig,
  writeDeveloperStoredConfig,
} from "./storage.js";
import {
  defaultModelApiKey,
  defaultOcrProvider,
  defaultPaddleToken,
} from "./runtime.js";

function preferNonEmpty(primary: unknown = "", fallback: unknown = "") {
  const a = `${primary ?? ""}`.trim();
  if (a) {
    return a;
  }
  return `${fallback ?? ""}`.trim();
}

export function mergeBrowserConfigWithRuntimeDefaults(
  primary: Record<string, unknown> | object | null | undefined = {},
  fallback: Record<string, unknown> | object | null | undefined = {},
) {
  const source = primary && typeof primary === "object"
    ? primary as Record<string, unknown>
    : {};
  const defaults = fallback && typeof fallback === "object"
    ? fallback as Record<string, unknown>
    : {};
  const sourceProvider = typeof source.ocrProvider === "string" ? source.ocrProvider.trim() : "";
  const fallbackProvider = typeof defaults.ocrProvider === "string" ? defaults.ocrProvider.trim() : "";
  return normalizeBrowserStoredConfig({
    ocrProvider: sourceProvider || fallbackProvider,
    paddleToken: preferNonEmpty(source.paddleToken, defaults.paddleToken),
    modelApiKey: preferNonEmpty(source.modelApiKey, defaults.modelApiKey),
  });
}

/**
 * Đọc thông tin xác thực của người dùng:
 * - Trình duyệt: localStorage
 * - Desktop: hợp nhất desktop snapshot với bản sao localStorage (ưu tiên giá trị không rỗng)
 *   Tránh khóa nhầm cổng AI khi giá trị vừa lưu vào bản sao/state nhưng snapshot vẫn có Key rỗng.
 */
export function loadBrowserStoredConfig() {
  const runtimeDefaults = {
    ocrProvider: defaultOcrProvider(),
    paddleToken: defaultPaddleToken(),
    modelApiKey: defaultModelApiKey(),
  };
  const fromStorage = mergeBrowserConfigWithRuntimeDefaults(
    readBrowserStoredConfig(),
    runtimeDefaults,
  );
  if (!isDesktopMode()) {
    return fromStorage;
  }
  const snapshot = persistedDesktopSnapshot();
  if (!snapshot?.browserConfig) {
    return fromStorage;
  }
  return mergeBrowserConfigWithRuntimeDefaults(snapshot.browserConfig, fromStorage);
}

export function saveBrowserStoredConfig(payload = {}) {
  writeBrowserStoredConfig(payload);
}

export async function savePersistedBrowserStoredConfig(payload = {}) {
  const nextBrowserConfig = normalizeBrowserStoredConfig(payload);
  saveBrowserStoredConfig(nextBrowserConfig);
  return savePersistedBrowserConfig(nextBrowserConfig);
}

export function loadDeveloperStoredConfig() {
  const snapshot = persistedDesktopSnapshot();
  return isDesktopMode() && snapshot
    ? snapshot.developerConfig
    : normalizeDeveloperStoredConfig(readDeveloperStoredConfig());
}

export function saveDeveloperStoredConfig(payload = {}) {
  writeDeveloperStoredConfig(payload);
}

export async function savePersistedDeveloperStoredConfig(payload = {}) {
  const nextDeveloperConfig = normalizeDeveloperStoredConfig(payload);
  saveDeveloperStoredConfig(nextDeveloperConfig);
  return savePersistedDeveloperConfig(nextDeveloperConfig);
}
