// Download progress toast host (Stage B: shadcn refactoring, eliminating 3 identical
// DownloadToastHost.jsx copies -- old home/reader/detail copies deleted,
// all using this single shared implementation).
//
// Interface contract unchanged: private implementation details of src/js/utils/download-feedback.js
// use `document.querySelector("download-toast").setState(state)/.hide()` --
// this file itself is not part of this refactor scope, and no other callers directly depend on DOM structure,
// only indirectly consuming via showDownloadToast, showDownloadPreparing, updateDownloadProgress,
// completeDownloadToast, failDownloadToast. Therefore, we continue rendering a `<download-toast>`
// placeholder element attaching setState/hide methods (using the same ref pattern as the 3 old files),
// with zero consumer modifications.
//
// Internal rendering uses Sonner (<Toaster/> from src/components/ui/sonner.jsx):
// setState/hide no longer manually querySelector DOM elements, but invoke
// toast.custom(..., { id: TOAST_ID, duration: Infinity }) / toast.dismiss(...).
// Card inner structure/id (#download-toast-title etc.)/class (download-toast-card etc.)
// are preserved as-is (tests/artifact-downloads-react.test.mjs asserts toast title text by id,
// and visuals reuse existing CSS without adopting Sonner's default skin) -- only outer fixed positioning/hierarchy/
// entrance animations are handled by Sonner's <Toaster/> (fixed positioning rules for download-toast
// shells in src/styles/components.utilities.css have been retired accordingly, see comments there).
// Sonner does not apply its own card skin to toast.custom() content by default
// (data-styled is determined by toast.jsx, see node_modules/sonner source),
// so both style sets do not conflict.

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
      {/* download-feedback.js query placeholder, not rendered (Sonner handles actual visible UI). */}
      <download-toast style={{ display: "none" }} aria-hidden="true" ref={attach} />
    </>
  );
}





