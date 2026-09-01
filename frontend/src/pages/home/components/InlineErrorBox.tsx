// Inline error box (React version <inline-error-box>, Compare components/feedback/inline-error-box.js).
//
// Data Source: "error-box" Slot of text store (mirror ui/text.js setText("error-box") special case).
// value is error-diagnostic Object spread "View diagnostics + Copy diagnostics"; String is plain text.
// Preserve <inline-error-box> Tags and log/error-box/inline-error-box classes (CSS Equity).

import { useState } from "react";
import { messageForErrorBox } from "../../../js/utils/error-diagnostics.js";
import { copyText } from "../../../js/utils/clipboard.js";
import { useStoreSnapshot } from "../../../shared/react/use-store.js";
import { useHomeServices } from "../home-services-context.js";

const selectErrorBoxValue = (snapshot) => snapshot?.texts?.["error-box"];

export function InlineErrorBox() {
  const services = useHomeServices();
  const value = useStoreSnapshot(services.stores.text, selectErrorBoxValue);
  const [copyLabel, setCopyLabel] = useState("Copy Diagnosis");

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
              <summary>View Diagnostics</summary>
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
