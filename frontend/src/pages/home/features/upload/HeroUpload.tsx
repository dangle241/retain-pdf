// Upload瓦片家族(Side-by-side partials/main-content.html 的 .upload-tile-hero 区块逐 id 镜像).
//
// ViewStatusAll来自 upload/workflow 两个View store(纯逻辑控制器写入);
// 交互镜像旧 bindMainShellEvents + bindUploadTilePicker:
// - 瓦片空白处点击 → 触发FilesSelect(按钮/链接/输入除外)
// - #file click → prepareFilePicker(清空 value,保证重选同名Files也触发 change)
// - #file change → uploadFeature.handleFileSelected()
// - pages码区间 input → uploadFeature.constrainPageRanges({source})
// - #credential-gate-action → openBrowserCredentials(非 setupMode → Settings → API)

import { useCallback } from "react";
import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { APP_EVENTS } from "../../composition/external.js";

function CredentialGate({ visible }) {
  function handleGateAction(event) {
    event.preventDefault();
    document.dispatchEvent(new CustomEvent(APP_EVENTS.openBrowserCredentials));
  }

  return (
    <div id="credential-gate" className={`credential-gate${visible ? "" : " hidden"}`}>
      <div className="credential-gate-panel" aria-live="polite">
        <span className="credential-gate-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M8 11V8a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="5" y="11" width="14" height="10" rx="3" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="16" r="1.2" fill="currentColor" />
          </svg>
        </span>
        <strong id="credential-gate-title">API settings required</strong>
        <em id="credential-gate-help">Set your OCR Token and DeepSeek Key in Settings → API Settings to enable PDF upload.</em>
        <button id="credential-gate-action" type="button" className="credential-gate-action" onClick={handleGateAction}>
          Open Settings
        </button>
      </div>
    </div>
  );
}

function InlinePageRange({ upload, onConstrain, onPatch }) {
  const maxAttr = upload.pageRangeMax > 0 ? { max: `${upload.pageRangeMax}` } : {};

  function handleInput(source) {
    return (event) => {
      onPatch(source === "start"
        ? { pageRangeStart: event.target.value }
        : { pageRangeEnd: event.target.value });
      onConstrain(source);
    };
  }

  return (
    <div
      id="inline-page-range"
      className={`inline-page-range${upload.inlinePageRangeVisible ? "" : " hidden"}`}
      aria-label="Translation page range scope"
    >
      <label>
        <span>Start page</span>
        <input
          id="page-range-start"
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          autoComplete="off"
          placeholder="1"
          {...maxAttr}
          value={upload.pageRangeStart}
          onInput={handleInput("start")}
        />
      </label>
      <label>
        <span>End page</span>
        <input
          id="page-range-end"
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          autoComplete="off"
          placeholder="total pages"
          {...maxAttr}
          value={upload.pageRangeEnd}
          onInput={handleInput("end")}
        />
      </label>
    </div>
  );
}

function TranslationBudgetNote({ budget }) {
  const classes = [
    "translation-budget-note",
    budget.visible ? "" : "hidden",
    budget.tone === "error" ? "is-error" : "",
    budget.tone === "valid" ? "is-valid" : "",
  ].filter(Boolean).join(" ");
  return (
    <div id="translation-budget-note" className={classes} aria-live="polite">
      {budget.visible ? budget.message : null}
      {budget.visible && budget.blocking ? (
        <>
          {" · "}
          <a href={budget.topUpUrl} target="_blank" rel="noopener noreferrer">Go to top up</a>
        </>
      ) : null}
    </div>
  );
}

export function HeroUpload() {
  const services = useHomeServices();
  const upload = useStoreSnapshot(services.stores.uploadView);
  const workflow = useStoreSnapshot(services.stores.workflowView);

  const fileInputRef = useCallback((node) => {
    services.uploadDomRefs.fileInput = node;
  }, [services]);

  // 镜像 bindUploadTilePicker:空白处点击代理到FilesSelect
  function handleTileClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.closest("button") || target.closest("a") || target.closest("input")) {
      return;
    }
    const fileInput = services.uploadDomRefs.fileInput;
    if (!fileInput || fileInput.disabled) {
      return;
    }
    fileInput.click();
  }

  const tileClasses = [
    "upload-tile",
    "upload-tile-hero",
    upload.tileLocked ? "is-locked" : "",
    upload.ready ? "is-ready" : "",
    upload.uploading ? "is-uploading" : "",
  ].filter(Boolean).join(" ");

  return (
    <>
      <div className={tileClasses} onClick={handleTileClick}>
        <input
          id="file"
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          ref={fileInputRef}
          disabled={!upload.tileEnabled}
          onClick={() => services.uploadDomRefs.fileInput && (services.uploadDomRefs.fileInput.value = "")}
          onChange={() => void services.features.uploadFeature?.handleFileSelected()}
        />
        <span
          id="upload-fill"
          className="upload-fill"
          aria-hidden="true"
          style={{ width: `${upload.progressPercent}%` }}
        ></span>
        <CredentialGate visible={upload.credentialGateVisible} />
        <span id="upload-glyph" className={`upload-glyph${upload.tileEnabled ? "" : " hidden"}`} aria-hidden="true">
          <span className="upload-glyph-h"></span>
          <span className="upload-glyph-v"></span>
        </span>
        <strong
          id="file-label"
          className={upload.labelVisible ? "" : "hidden"}
          title={upload.labelTitle}
        >
          {upload.label}
        </strong>
        <em id="upload-help" className={upload.helpVisible ? "" : "hidden"}>{upload.help}</em>
        <div className={`upload-meta upload-meta-inline${upload.tileEnabled ? "" : " hidden"}`}>
          <span>Single PDF</span>
          <span>Max 50MB</span>
          <span>Up to 999 pages</span>
        </div>
        <div id="upload-status" className={`upload-status${upload.statusVisible ? "" : " hidden"}`}>
          {upload.status}
        </div>
        <div
          id="upload-progress-panel"
          className={`upload-progress-panel${upload.progressVisible ? "" : " hidden"}`}
          aria-live="polite"
        >
          <span id="upload-progress-text">{upload.progressText}</span>
        </div>
        <InlinePageRange
          upload={upload}
          onPatch={services.uploadViewActions.patch}
          onConstrain={(source) => services.features.uploadFeature?.constrainPageRanges({ source })}
        />
        <TranslationBudgetNote budget={workflow.budget} />
      </div>

      {/* UploadDone后给出明确二选一: Translate directly(提交 job)/ 仅Favorite(关对话框Added) */}
      <div
        id="upload-ready-hint"
        className={`upload-ready-hint${upload.ready ? "" : " hidden"}`}
        aria-live="polite"
      >
        Files are ready: you can <strong>Translate directly</strong> or <strong>Add to favorites</strong> to translate later.
      </div>

      <div id="upload-action-slot" className={`upload-action-slot${upload.actionSlotVisible ? "" : " hidden"}`}>
        <div className="upload-action-group">
          <button
            id="page-range-btn"
            type="button"
            className={`page-range-mini secondary${workflow.pageRangeButtonVisible ? "" : " hidden"}`}
            aria-label="Translation settings"
            title="Advanced page range and translation options"
            onClick={() => services.features.uploadFeature?.openPageRangeDialog()}
          >
            Select items
          </button>
          <button
            id="store-only-btn"
            type="button"
            className={`secondary${upload.ready ? "" : " hidden"}`}
            disabled={!upload.ready || workflow.submitBusy}
            title="Add to library only without starting translation"
            onClick={() => services.library.actions.storeOnly?.()}
          >
            仅Favorite
          </button>
          <button
            id="submit-btn"
            type="submit"
            disabled={workflow.submitDisabled || workflow.submitBusy}
            {...(workflow.submitBusy ? { "data-busy": "1" } : {})}
            title="Start translation task immediately after upload completes"
          >
            {workflow.submitBusy ? "Submitting..." : (workflow.submitLabel || "Translate directly")}
          </button>
        </div>
      </div>
    </>
  );
}





