// Thẻ API dịch hỗ trợ các endpoint tương thích OpenAI. Preset chỉ điền nhanh;
// người dùng vẫn có thể sửa Base URL và model trước khi lưu.

import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";
import { useCredentialsController } from "./useCredentialsController.js";
import {
  getTranslationProviderPreset,
  inferTranslationProvider,
  TRANSLATION_PROVIDER_DEFINITION,
  TRANSLATION_PROVIDER_PRESETS,
} from "../../composition/external.js";

const { browser: BROWSER_IDS } = CREDENTIAL_DOM_IDS;

function validationIcon(tone = "", content = "") {
  if (!content) {
    return "";
  }
  if (tone === "valid") {
    return "✓";
  }
  if (tone === "error") {
    return "!";
  }
  return "…";
}

export function DeepSeekPanel() {
  const { view, handlers, elementsRef } = useCredentialsController();
  const validation = view.deepSeek || { message: "", tone: "" };
  const content = `${validation.message || ""}`.trim();
  const badgeClasses = [
    "token-inline-status",
    content ? "" : "hidden",
    validation.tone === "valid" ? "is-valid" : "",
    validation.tone === "error" ? "is-error" : "",
    content && !validation.tone ? "is-pending" : "",
  ].filter(Boolean).join(" ");

  function resetValidation() {
    handlers?.resetDeepSeekValidation?.();
  }

  function applyProviderPreset(event) {
    const preset = getTranslationProviderPreset(event.currentTarget.value);
    if (!preset || preset.id === "custom") {
      resetValidation();
      return;
    }
    if (elementsRef.modelBaseUrlInput) {
      elementsRef.modelBaseUrlInput.value = preset.baseUrl;
    }
    if (elementsRef.modelNameInput) {
      elementsRef.modelNameInput.value = preset.model;
    }
    resetValidation();
  }

  function syncProviderFromBaseUrl(event) {
    if (elementsRef.modelProviderSelect) {
      elementsRef.modelProviderSelect.value = inferTranslationProvider(event.currentTarget.value);
    }
    resetValidation();
  }

  return (
    <section className="credential-card">
      <div className="credential-card-head">
        <h3>{TRANSLATION_PROVIDER_DEFINITION.label}</h3>
      </div>
      <label>
        <span className="developer-label">Nhà cung cấp</span>
        <select
          id={BROWSER_IDS.modelProvider}
          aria-label="Nhà cung cấp API dịch"
          defaultValue="openai"
          ref={(node) => { elementsRef.modelProviderSelect = node || null; }}
          onChange={applyProviderPreset}
        >
          {TRANSLATION_PROVIDER_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>{preset.label}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="developer-label">{TRANSLATION_PROVIDER_DEFINITION.keyLabel}</span>
        <span className="credential-input-row">
          <span className="credential-secret-field">
            <input
              id={BROWSER_IDS.apiKey}
              type="password"
              autoComplete="off"
              placeholder={TRANSLATION_PROVIDER_DEFINITION.keyPlaceholder}
              defaultValue=""
              ref={(node) => { elementsRef.apiKeyInput = node || null; }}
              onInput={resetValidation}
            />
          </span>
          <span className="credential-key-links">
            {TRANSLATION_PROVIDER_PRESETS.filter((preset) => preset.docsUrl).map((preset) => (
              <a key={preset.id} className="credential-card-link" href={preset.docsUrl} target="_blank" rel="noopener noreferrer">
                {preset.docsLabel}
              </a>
            ))}
          </span>
        </span>
      </label>
      <label>
        <span className="developer-label">Base URL</span>
        <input
          id={BROWSER_IDS.modelBaseUrl}
          name="model_base_url"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://api.example.com/v1"
          defaultValue=""
          ref={(node) => { elementsRef.modelBaseUrlInput = node || null; }}
          onInput={syncProviderFromBaseUrl}
        />
      </label>
      <label>
        <span className="developer-label">Model</span>
        <input
          id={BROWSER_IDS.modelName}
          name="model_name"
          type="text"
          autoComplete="off"
          list="translation-model-suggestions"
          placeholder="Tên model của nhà cung cấp"
          defaultValue=""
          ref={(node) => { elementsRef.modelNameInput = node || null; }}
          onInput={resetValidation}
        />
        <datalist id="translation-model-suggestions">
          {TRANSLATION_PROVIDER_PRESETS.filter((preset) => preset.model).map((preset) => (
            <option key={preset.id} value={preset.model} />
          ))}
          <option value="deepseek-reasoner" />
        </datalist>
      </label>
      <div className="credential-card-actions">
        <button
          id={BROWSER_IDS.deepSeekValidateButton}
          type="button"
          className="app-button secondary"
          onClick={() => handlers?.validateDeepSeek?.()}
        >
          {TRANSLATION_PROVIDER_DEFINITION.validationButtonLabel}
        </button>
        <span id={BROWSER_IDS.deepSeekValidation} className={badgeClasses} title={content || TRANSLATION_PROVIDER_DEFINITION.validationIdleMessage}>
          {validationIcon(validation.tone, content)}
        </span>
        <a
          id={BROWSER_IDS.deepSeekTopUpLink}
          className={`credential-top-up-link${view.deepSeekTopUpVisible ? "" : " hidden"}`}
          href="https://platform.deepseek.com/top_up"
          target="_blank"
          rel="noopener noreferrer"
        >
          Nạp tiền
        </a>
      </div>
    </section>
  );
}
