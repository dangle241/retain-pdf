// Download menu (source/side-by-side/translated PDF): React-ization of old
// src/js/reader/download-actions.js. URL parsing/file name/disable reason all reuse pure
// logic (src/js/reader/downloads/resolve.js); protected download and progress toast go
// through features/reader-dialog/downloads.js (same entry chain as old implementation).
// When context is null (boot not ready) all three buttons are disabled — matching old
// page sync() initial disabled state before first content.

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
    // Close popover after selection (old closeMenu semantics)
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
      // Diagnostic info goes to console (old implementation sent via onStatus, reader pages never
      // received); toast is user-facing
      console.error(buildErrorDiagnostic(err, {
        operation: descriptor.operation,
        url,
        jobId: context?.jobId || "",
      }));
      failDownloadToast(err.message || "Download failed");
    }
  }

  return (
    <details className="reader-download-menu" ref={menuRef}>
      <summary className="reader-topbar-action-btn reader-download-trigger" aria-label="Download PDF">Download</summary>
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
                ? `Download ${READER_DOWNLOAD_ACTIONS[action]?.label || "PDF"}`
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


