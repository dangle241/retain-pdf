// Hộp lỗi nội tuyến (bản React <inline-error-box>, đối chiếu components/feedback/inline-error-box.js).
//
// Nguồn dữ liệu: slot "error-box" của text store (phản chiếu trường hợp đặc biệt setText("error-box") trong ui/text.js).
// Khi value là đối tượng error-diagnostic, mở "Xem chẩn đoán + Sao chép chẩn đoán"; khi là chuỗi thì dùng văn bản thuần.
// Giữ thẻ <inline-error-box> và class log/error-box/inline-error-box để CSS tương đương.

import { useState } from "react";
import { messageForErrorBox } from "../../../js/utils/error-diagnostics.js";
import { copyText } from "../../../js/utils/clipboard.js";
import { useStoreSnapshot } from "../../../shared/react/use-store.js";
import { useHomeServices } from "../home-services-context.js";

const selectErrorBoxValue = (snapshot) => snapshot?.texts?.["error-box"];

export function InlineErrorBox() {
  const services = useHomeServices();
  const value = useStoreSnapshot(services.stores.text, selectErrorBoxValue);
  const [copyLabel, setCopyLabel] = useState("Sao chép chẩn đoán");

  const summary = messageForErrorBox(value);
  const text = `${summary ?? ""}`.trim();
  const diagnostic = value && typeof value === "object" && value.kind === "error-diagnostic"
    ? `${value.diagnostic || ""}`.trim()
    : "";
  const hidden = !text || text === "-";

  async function handleCopy() {
    try {
      await copyText(diagnostic);
      setCopyLabel("Đã sao chép");
      globalThis.window?.setTimeout(() => setCopyLabel("Sao chép chẩn đoán"), 1600);
    } catch {
      setCopyLabel("Sao chép thất bại");
    }
  }

  return (
    <inline-error-box
      id="error-box-inline"
      class={`log error-box inline-error-box${hidden ? " hidden" : ""}`}
      aria-live="polite"
    >
      {hidden || !diagnostic ? (summary ?? "-") : (
        <>
          <div className="inline-error-summary">{summary}</div>
          <div className="inline-error-actions">
            <details className="inline-error-details">
              <summary>Xem chẩn đoán</summary>
              <pre>{diagnostic}</pre>
            </details>
            <button type="button" className="inline-error-copy-btn" onClick={handleCopy}>
              {copyLabel}
            </button>
          </div>
        </>
      )}
    </inline-error-box>
  );
}
