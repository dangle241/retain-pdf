// Download progress toast host (Phase B: shadcn refactor, eliminate 3 byte-for-byte identical
// DownloadToastHost.jsx Copy and Paste——home/reader/detail 3 old files deleted.,
// Switch all to this shared implementation)。
//
// API contract unchanged:src/js/utils/download-feedback.js private implementation details are
// `document.querySelector("download-toast").setState(state)/.hide()`——
// This file is out of scope for this refactor, no other callers depend on it directly. DOM structure via only
// showDownloadToast/showDownloadPreparing/updateDownloadProgress/
// completeDownloadToast/failDownloadToast these exported functions are indirectly consumed by,So here
// Continue to render a `<download-toast>` placeholder element and mount setState/hide methods (Vs Old 3
// Same file. ref Technique),Zero consumer changes.
//
// Switch to internal rendering Sonner (src/components/ui/sonner.jsx <Toaster/>):
// setState/hide no longer manual querySelector to change DOM text, but calls
// toast.custom(..., { id: TOAST_ID, duration: Infinity }) / toast.dismiss(...)。
// Card inner structure/id(#download-toast-title etc.)/class(download-toast-card etc.)
// Keep as-is (tests/artifact-downloads-react.test.mjs asserts toast title by id,
// UI reuse existing components. Simplify: avoid duplication, enhance maintainability. CSS, rejected Sonner default skin) â Outer layer fixed positioning only/z-index/
// Entry animation handoff to Sonner <Toaster/> (src/styles/components.utilities.css
// where download-toast shell fixed positioning rules are retired, reason see comments in that file).
// Sonner toast.custom() rendered content does not apply its own card skin by default
// (data-styled determined by toast.jsx presence, see node_modules/sonner source code),
// Two visual sets don't conflict.

import { useCallback } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner.jsx";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "download-toast": any;
    }
  }
}

const TOAST_ID = "download-toast";

function DownloadToastCard({
title = "Downloading",
status = "Preparing...",
meta = "Waiting for response...",
  percent = NaN,
  tone = "progress",
}) {
  const width = Number.isFinite(percent)
    ? Math.max(4, Math.min(100, Number(percent) || 0))
    : 18;
  return (
    <div className="download-toast-card" data-tone={tone} aria-live="polite">
      <div className="download-toast-head">
        <div id="download-toast-title" className="download-toast-title">{title}</div>
        <div id="download-toast-status" className="download-toast-status">{status}</div>
      </div>
      <div className="download-toast-track">
        <span id="download-toast-bar" className="download-toast-bar" style={{ width: `${width}%` }} />
      </div>
      <div id="download-toast-meta" className="download-toast-meta">{meta}</div>
    </div>
  );
}

function applyToastState(state: any = {}) {
  const {
    visible = false,
title = "Downloading",
status = "Preparing...",
meta = "Waiting for response...",
    percent = NaN,
    tone = "progress",
  } = state;
  if (!visible) {
    toast.dismiss(TOAST_ID);
    return;
  }
  toast.custom(
    () => <DownloadToastCard title={title} status={status} meta={meta} percent={percent} tone={tone} />,
    { id: TOAST_ID, duration: Infinity },
  );
}

export function DownloadToastHost() {
  const attach = useCallback((host) => {
    if (!host) {
      return;
    }
    host.setState = applyToastState;
    host.hide = () => toast.dismiss(TOAST_ID);
  }, []);

  return (
    <>
      <Toaster position="bottom-right" />
      {/* download-feedback.js Query placeholder,Not rendered.(Sonner handles actual visibility UI)。 */}
      <download-toast style={{ display: "none" }} aria-hidden="true" ref={attach} />
    </>
  );
}
