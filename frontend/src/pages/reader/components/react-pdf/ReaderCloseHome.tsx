// Reader "return to home page"
//
// 1) Soft open (home page SoftReaderHost iframe) → postMessage parent page history.back, home page does not refresh
// 2) Standalone reader.html entered from home page assign → history.back
// 3) Deep link direct → location.assign(index.html)

import { X } from "lucide-react";
import { peekHomeReturnState } from "../../../../shared/navigation/home-return-state.js";
import { SOFT_READER_CLOSE_MESSAGE } from "../../../../shared/navigation/soft-reader.js";

function homeIndexUrl() {
  return new URL("./index.html", window.location.href).href;
}

function requestSoftHostClose(): boolean {
  if (typeof window === "undefined") return false;
  if (window.self === window.top) return false;
  try {
    window.parent.postMessage(
      { type: SOFT_READER_CLOSE_MESSAGE },
      window.location.origin,
    );
    return true;
  } catch {
    return false;
  }
}

/** Navigate from reader page back to home page */
export function navigateReaderToHome() {
  if (typeof window === "undefined") return;

  // Soft reader layer: ask parent to unload layer, never assign home page inside iframe
  if (requestSoftHostClose()) {
    return;
  }

  const saved = peekHomeReturnState();
  if (saved?.allowBack && window.history.length > 1) {
    window.history.back();
    return;
  }

  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    if (
      ref
      && ref.origin === window.location.origin
      && !/reader\.html/i.test(ref.pathname)
      && window.history.length > 1
    ) {
      window.history.back();
      return;
    }
  } catch {
    /* ignore */
  }

  window.location.assign(homeIndexUrl());
}

export function ReaderCloseHome() {
  return (
    <button
      id="reader-close-home-btn"
      type="button"
      className="reader-close-home-btn"
      aria-label="Return to home page"
      title="Return to home page"
      onClick={navigateReaderToHome}
    >
      <X className="reader-close-home-icon" size={18} strokeWidth={2.25} aria-hidden />
      <span className="reader-close-home-label">Close</span>
    </button>
  );
}



