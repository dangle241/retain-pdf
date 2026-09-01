// 行内错误盒(React 版 <inline-error-box>,Side-by-side components/feedback/inline-error-box.js).
//
// Data源:text store 的 "error-box" 槽位(镜像 ui/text.js 的 setText("error-box") 特例).
// value 为 error-diagnostic 对象时展开"View诊断 + Copy Diagnostics";字符串时纯文books.
// 保留 <inline-error-box> Tags与 log/error-box/inline-error-box 类(CSS 平权).

import { useState } from "react";
import { messageForErrorBox } from "../../../js/utils/error-diagnostics.js";
import { copyText } from "../../../js/utils/clipboard.js";
import { useStoreSnapshot } from "../../../shared/react/use-store.js";
import { useHomeServices } from "../home-services-context.js";

const selectErrorBoxValue = (snapshot) => snapshot?.texts?.["error-box"];

export function InlineErrorBox() {
  const services = useHomeServices();
  const value = useStoreSnapshot(services.stores.text, selectErrorBoxValue);
  const [copyLabel, setCopyLabel] = useState("Copy Diagnostics");

  const summary = messageForErrorBox(value);
  const text = `${summary ?? ""}`.trim();
  const diagnostic = value && typeof value === "object" && value.kind === "error-diagnostic"
    ? `${value.diagnostic || ""}`.trim()
    : "";
  const hidden = !text || text === "-";

  async function handleCopy() {
    try {
      await copyText(diagnostic);
      setCopyLabel("Copied");
      globalThis.window?.setTimeout(() => setCopyLabel("Copy Diagnostics"), 1600);
    } catch {
      setCopyLabel("Copy Failed");
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
              <summary>View诊断</summary>
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




