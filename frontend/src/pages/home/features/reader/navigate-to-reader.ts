// Home â Reading page navigation (injectable for testing)
//
// Default "soft open": history.pushState + SoftReaderHost Fullscreen layer, homepage not unmounted.
// replace / Non-homepage docs. / CORS enabled. Check configuration. location.replace|assign。

import { captureHomeReturnState } from "../../../../shared/navigation/home-return-state.js";
import { trySoftOpenReader } from "../../../../shared/navigation/soft-reader.js";

export type ReaderNavigateOptions = {
  replace?: boolean;
};

export type ReaderNavigateFn = (url: string, options?: ReaderNavigateOptions) => void;

const defaultNavigate: ReaderNavigateFn = (url, { replace = false } = {}) => {
  const target = `${url || ""}`.trim();
  if (!target) return;
  // Record scroll; home page remains mounted during soft open, serving as fallback.
  captureHomeReturnState({ allowBack: !replace });
  // Prefer soft open (home page) SPA While still present, even if address bar already is reader.html Can reopen.
  if (!replace && trySoftOpenReader(target)) {
    return;
  }
  if (replace) {
    // Deep link launch: prefer soft open; hard enter on failure
    if (trySoftOpenReader(target)) {
      return;
    }
    window.location.replace(target);
    return;
  }
// Independent reader page / Cross-page: full-page entry
  window.location.assign(target);
};

let navigateImpl: ReaderNavigateFn = defaultNavigate;

/** Test-only: inject mock nav, pass after test. null Reset */
export function setReaderNavigateForTests(fn: ReaderNavigateFn | null) {
  navigateImpl = fn || defaultNavigate;
}

export function navigateToReader(url: string, options: ReaderNavigateOptions = {}) {
  navigateImpl(url, options);
}
