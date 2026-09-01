import {
  defaultModelBaseUrl,
  defaultModelName,
} from "../../config/runtime.js";
import {
  loadBrowserStoredConfig,
  loadDeveloperStoredConfig,
} from "../../config/persisted-config.js";
import { defaultCredentialsStatePort } from "../../features/credentials/default-state-port.js";

/** Get first trim Non-empty string; whitespace / Empty string invalid credential. */
function firstNonEmpty(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    const value = `${candidate ?? ""}`.trim();
    if (value) {
      return value;
    }
  }
  return "";
}

/**
* Read "Settings â API Settings" Model and API Key.
* Priority: memory credentials state â Persist config (desktop snapshot / localStorage).
 * Skip read. runtime-config Secret key.
 */
export function readSettingsModelApiKey(
  browserConfig = loadBrowserStoredConfig(),
): string {
  try {
    const live = defaultCredentialsStatePort.getCredentials?.()?.modelApiKey;
    const fromLive = `${live ?? ""}`.trim();
    if (fromLive) {
      return fromLive;
    }
  } catch {
    /* ignore */
  }
  return `${browserConfig?.modelApiKey ?? ""}`.trim();
}

export function resolveReaderAiConfig({
  browserConfig = loadBrowserStoredConfig(),
  developerConfig = loadDeveloperStoredConfig(),
} = {}) {
// Model Key: User settings only; baseUrl / model: Rollbackable runtime Default (non-key)
  return {
    apiKey: readSettingsModelApiKey(browserConfig),
    baseUrl: firstNonEmpty(developerConfig?.baseUrl, defaultModelBaseUrl()),
    model: firstNonEmpty(developerConfig?.model, defaultModelName()),
    provider: "deepseek",
  };
}

/** Is downstream model configured in settings? API Key(Pre-conversation gate). */
export function hasModelApiKey(): boolean {
  return Boolean(readSettingsModelApiKey());
}

/** Dispatch after credential save for AI Refresh AI input gate immediately. */
export const CREDENTIALS_CHANGED_EVENT = "retainpdf:credentials-changed";

export function notifyCredentialsChanged(): void {
  try {
    document.dispatchEvent(new CustomEvent(CREDENTIALS_CHANGED_EVENT));
  } catch {
    /* ignore non-DOM env */
  }
}

export const MISSING_MODEL_API_KEY_MESSAGE =
  "Missing model API KeyGo to Settings → API Fill Settings DeepSeek Wait for model Key(not the backend X-API-Key）。";
