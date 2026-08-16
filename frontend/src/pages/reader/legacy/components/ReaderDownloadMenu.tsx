// Menu tải xuống (PDF gốc/đối chiếu/bản dịch): chuyển src/js/reader/download-actions.js cũ sang React.
// Phân giải URL/tên file/lý do vô hiệu hóa đều tái sử dụng logic thuần (src/js/reader/downloads/resolve.js);
// tải được bảo vệ và toast tiến độ dùng features/reader-dialog/downloads.js (cùng chuỗi với triển khai cũ).
// Khi context là null (boot chưa sẵn sàng), vô hiệu hóa cả ba nút; giống disabled ban đầu trước sync() của trang cũ.

import { useRef, useState } from "react";
import {
  READER_DOWNLOAD_ACTIONS,
  disabledReason,
  resolveReaderDownloadName,
  resolveReaderDownloadUrls,
  trimString,
} from "../../../../js/reader/downloads/resolve.js";
import { downloadProtectedResource } from "../../../../js/features/reader-dialog/downloads.js";
import { failDownloadToast } from "../../../../js/utils/download-feedback.js";
import { buildErrorDiagnostic } from "../../../../js/utils/error-diagnostics.js";

const ACTION_ORDER = ["source", "sideBySide", "translated"];

export function ReaderDownloadMenu({ context }) {
  const menuRef = useRef(null);
  const [busyAction, setBusyAction] = useState("");

  const urls = context
    ? resolveReaderDownloadUrls(context)
    : { source: "", sideBySide: "", translated: "" };

  async function handleDownload(action, url) {
    const descriptor = READER_DOWNLOAD_ACTIONS[action];
    if (!descriptor || !url || busyAction) {
      return;
    }
    // Thu popover sau khi chọn (ngữ nghĩa closeMenu cũ).
    if (menuRef.current?.open) {
      menuRef.current.open = false;
    }
    try {
      const filename = resolveReaderDownloadName(action, context);
      await downloadProtectedResource(
        context.fetchProtected,
        url,
        filename,
        filename,
        null,
        (busy) => setBusyAction(busy ? action : ""),
      );
    } catch (err) {
      // Thông tin chẩn đoán vào console (triển khai cũ gửi qua onStatus nhưng trang reader chưa từng có phía nhận); toast dành cho người dùng.
      console.error(buildErrorDiagnostic(err, {
        operation: descriptor.operation,
        url,
        jobId: context?.jobId || "",
      }));
      failDownloadToast(err.message || "Tải xuống thất bại");
    }
  }

  return (
    <details className="reader-download-menu" ref={menuRef}>
      <summary className="reader-topbar-action-btn reader-download-trigger" aria-label="Tải PDF">Tải xuống</summary>
      <div className="reader-download-popover">
        {ACTION_ORDER.map((action) => {
          const url = trimString(urls[action]);
          const enabled = Boolean(url) && busyAction !== action;
          return (
            <button
              key={action}
              id={`reader-download-${action}-btn`}
              type="button"
              className="reader-download-option"
              disabled={!enabled}
              aria-disabled={enabled ? "false" : "true"}
              title={enabled
                ? `Tải ${READER_DOWNLOAD_ACTIONS[action]?.label || "PDF"}`
                : disabledReason(action, urls)}
              data-busy={busyAction === action ? "1" : ""}
              onClick={() => void handleDownload(action, url)}
            >{READER_DOWNLOAD_ACTIONS[action].label}</button>
          );
        })}
      </div>
    </details>
  );
}
