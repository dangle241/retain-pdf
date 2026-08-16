// Họ ô tải lên (đối chiếu khối .upload-tile-hero trong partials/main-content.html và phản chiếu từng ID).
//
// Toàn bộ trạng thái view đến từ hai view store upload/workflow (controller logic thuần ghi vào);
// tương tác phản chiếu bindMainShellEvents + bindUploadTilePicker cũ:
// - Bấm vùng trống của ô → kích hoạt chọn file (trừ nút/liên kết/input).
// - Bấm #file → prepareFilePicker (xóa value để bảo đảm chọn lại file cùng tên vẫn phát change).
// - #file change → uploadFeature.handleFileSelected()
// - Input phạm vi trang → uploadFeature.constrainPageRanges({source}).
// - #credential-gate-action → openBrowserCredentials (không phải setupMode → Cài đặt → API).

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
        <strong id="credential-gate-title">Vui lòng hoàn tất cài đặt API trước</strong>
        <em id="credential-gate-help">Nhập OCR Token và DeepSeek Key trong Cài đặt → Cài đặt API để có thể tải PDF lên.</em>
        <button id="credential-gate-action" type="button" className="credential-gate-action" onClick={handleGateAction}>
          Mở cài đặt
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
      aria-label="Phạm vi trang cần dịch"
    >
      <label>
        <span>Trang bắt đầu</span>
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
        <span>Trang kết thúc</span>
        <input
          id="page-range-end"
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Tổng số trang"
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
          <a href={budget.topUpUrl} target="_blank" rel="noopener noreferrer">Nạp tiền</a>
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

  // Phản chiếu bindUploadTilePicker: bấm vùng trống được ủy quyền sang chọn file.
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
          <span>Một tệp PDF</span>
          <span>Tối đa 50 MB</span>
          <span>Tối đa 999 trang</span>
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

      {/* Sau khi tải lên, đưa ra hai lựa chọn rõ ràng: dịch ngay (gửi tác vụ) / chỉ lưu (đóng hộp thoại và đưa vào thư viện). */}
      <div
        id="upload-ready-hint"
        className={`upload-ready-hint${upload.ready ? "" : " hidden"}`}
        aria-live="polite"
      >
        Tệp đã sẵn sàng: có thể <strong>Dịch ngay</strong>, hoặc <strong>chỉ lưu</strong> vào giá sách để dịch sau.
      </div>

      <div id="upload-action-slot" className={`upload-action-slot${upload.actionSlotVisible ? "" : " hidden"}`}>
        <div className="upload-action-group">
          <button
            id="page-range-btn"
            type="button"
            className={`page-range-mini secondary${workflow.pageRangeButtonVisible ? "" : " hidden"}`}
            aria-label="Cài đặt dịch nâng cao"
            title="Các tùy chọn nâng cao như phạm vi trang"
            onClick={() => services.features.uploadFeature?.openPageRangeDialog()}
          >
            Tùy chọn
          </button>
          <button
            id="store-only-btn"
            type="button"
            className={`secondary${upload.ready ? "" : " hidden"}`}
            disabled={!upload.ready || workflow.submitBusy}
            title="Chỉ thêm vào giá sách, không bắt đầu dịch"
            onClick={() => services.library.actions.storeOnly?.()}
          >
            Chỉ lưu
          </button>
          <button
            id="submit-btn"
            type="submit"
            disabled={workflow.submitDisabled || workflow.submitBusy}
            {...(workflow.submitBusy ? { "data-busy": "1" } : {})}
            title="Bắt đầu tác vụ dịch ngay sau khi tải lên"
          >
            {workflow.submitBusy ? "Đang gửi…" : (workflow.submitLabel || "Dịch ngay")}
          </button>
        </div>
      </div>
    </>
  );
}
