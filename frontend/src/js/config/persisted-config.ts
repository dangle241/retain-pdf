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

function preferNonEmpty(primary = "", fallback = "") {
  const a = `${primary ?? ""}`.trim();
  if (a) {
    return a;
  }
  return `${fallback ?? ""}`.trim();
}

/**
 * Read user credentials:
* - Browser: localStorage
* - Desktop: desktop snapshot and localStorage shadow merge (non-null precedence)
*   Avoid "Just saved shadow/state but snapshot still empty key" causing AI gate accidental lock.
 */
export function loadBrowserStoredConfig() {
  const fromStorage = normalizeBrowserStoredConfig(readBrowserStoredConfig());
  if (!isDesktopMode()) {
    return fromStorage;
  }
  const snapshot = persistedDesktopSnapshot();
  if (!snapshot?.browserConfig) {
    return fromStorage;
  }
  const fromSnap = normalizeBrowserStoredConfig(snapshot.browserConfig);
  return normalizeBrowserStoredConfig({
    ocrProvider: fromSnap.ocrProvider || fromStorage.ocrProvider,
    paddleToken: preferNonEmpty(fromSnap.paddleToken, fromStorage.paddleToken),
    modelApiKey: preferNonEmpty(fromSnap.modelApiKey, fromStorage.modelApiKey),
  });
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
