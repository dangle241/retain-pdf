// Inline error box (React version of <inline-error-box>, mirrors legacy components/feedback/inline-error-box.js).
//
// Data source: the "error-box" slot of the text store (mirrors the setText("error-box") special case from ui/text.js).
// When value is an error-diagnostic object, expands "View Diagnostics + Copy Diagnostics"; otherwise pure text.
// Preserve the <inline-error-box> tag and log/error-box/inline-error-box classes (CSS parity).

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




