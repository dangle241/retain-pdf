import {
  defaultModelBaseUrl,
  defaultModelName,
} from "../../config/runtime.js";
import {
  loadBrowserStoredConfig,
  loadDeveloperStoredConfig,
} from "../../config/persisted-config.js";
import { defaultCredentialsStatePort } from "../../features/credentials/default-state-port.js";

/** 取第一个 trim 后非空的字符串；空白 / 空串不算有效credentials. */
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
 * 读取"Settings → API Settings"里的模型 API Key.
 * 优先级: 内存 credentials Status → 持久化配置(桌面 snapshot / localStorage).
 * 不读 runtime-config key.
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
  // 模型 Key: 仅用户Settings；baseUrl / model 可回退 runtime 默认(非key)
  return {
    apiKey: readSettingsModelApiKey(browserConfig),
    baseUrl: firstNonEmpty(developerConfig?.baseUrl, defaultModelBaseUrl()),
    model: firstNonEmpty(developerConfig?.model, defaultModelName()),
    provider: "deepseek",
  };
}

/** yesno已在Settings中配置下游模型 API Key(对话前置门禁). */
export function hasModelApiKey(): boolean {
  return Boolean(readSettingsModelApiKey());
}

/** credentialsSave后派发, 供 AI 输入门禁立刻刷新. */
export const CREDENTIALS_CHANGED_EVENT = "retainpdf:credentials-changed";

export function notifyCredentialsChanged(): void {
  try {
    document.dispatchEvent(new CustomEvent(CREDENTIALS_CHANGED_EVENT));
  } catch {
    /* ignore non-DOM env */
  }
}

export const MISSING_MODEL_API_KEY_MESSAGE =
  "Missing model API key: enter a DeepSeek or other model key in Settings -> API Settings (not the backend X-API-Key).";





