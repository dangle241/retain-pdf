// DeepSeek(翻译模型)卡片(对照旧 components/dialogs/browser-credentials-dialog.js
// 的 DeepSeek 区块 + validation-view.js 的校验徽标/充值链接语义)。

import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";
import { useCredentialsController } from "./useCredentialsController.js";
import { TRANSLATION_PROVIDER_DEFINITION } from "../../composition/external.js";

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

  return (
    <section className="credential-card">
      <div className="credential-card-head">
        <h3>{TRANSLATION_PROVIDER_DEFINITION.label}</h3>
      </div>
      <label>
        <span className="credential-input-row">
          <span className="credential-secret-field">
            <input
              id={BROWSER_IDS.apiKey}
              type="password"
              autoComplete="off"
              placeholder={TRANSLATION_PROVIDER_DEFINITION.keyPlaceholder}
              defaultValue=""
              ref={(node) => { elementsRef.apiKeyInput = node || null; }}
              onInput={() => handlers?.resetDeepSeekValidation?.()}
            />
          </span>
          <a className="credential-card-link" href={TRANSLATION_PROVIDER_DEFINITION.docsUrl} target="_blank" rel="noopener noreferrer">
            {TRANSLATION_PROVIDER_DEFINITION.docsLabel}
          </a>
        </span>
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
          充值
        </a>
      </div>
    </section>
  );
}
