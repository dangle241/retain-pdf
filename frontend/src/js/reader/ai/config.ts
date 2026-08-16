import {
  defaultModelBaseUrl,
  defaultModelName,
} from "../../config/runtime.js";
import {
  loadBrowserStoredConfig,
  loadDeveloperStoredConfig,
} from "../../config/persisted-config.js";
import { defaultCredentialsStatePort } from "../../features/credentials/default-state-port.js";

/** Lấy chuỗi đầu tiên không rỗng sau trim; khoảng trắng/chuỗi rỗng không phải thông tin xác thực hợp lệ. */
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
 * Đọc API Key mô hình trong "Cài đặt → Cài đặt API".
 * Ưu tiên: trạng thái credentials trong bộ nhớ → cấu hình bền vững (desktop snapshot / localStorage).
 * Không đọc khóa trong runtime-config.
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
  // Key mô hình: chỉ từ cài đặt người dùng; baseUrl / model có thể lùi về mặc định runtime vì không phải bí mật.
  return {
    apiKey: readSettingsModelApiKey(browserConfig),
    baseUrl: firstNonEmpty(developerConfig?.baseUrl, defaultModelBaseUrl()),
    model: firstNonEmpty(developerConfig?.model, defaultModelName()),
    provider: "deepseek",
  };
}

/** API Key của mô hình phía dưới đã được cấu hình trong cài đặt hay chưa (cổng trước hội thoại). */
export function hasModelApiKey(): boolean {
  return Boolean(readSettingsModelApiKey());
}

/** Phát sau khi lưu thông tin xác thực để cổng nhập AI làm mới ngay. */
export const CREDENTIALS_CHANGED_EVENT = "retainpdf:credentials-changed";

export function notifyCredentialsChanged(): void {
  try {
    document.dispatchEvent(new CustomEvent(CREDENTIALS_CHANGED_EVENT));
  } catch {
    /* ignore non-DOM env */
  }
}

export const MISSING_MODEL_API_KEY_MESSAGE =
  "Thiếu API Key của mô hình: hãy vào Cài đặt → Cài đặt API để nhập Key của DeepSeek hoặc mô hình khác (không phải X-API-Key của backend).";
