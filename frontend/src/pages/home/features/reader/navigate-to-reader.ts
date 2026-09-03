// Main page → reading page navigation (injectable for testing).
//
// Default "soft open": history.pushState + SoftReaderHost full-screen layer, main page
// does not unmount. replace / non-main-page documents / cross-origin: still
// location.replace|assign.

import { captureHomeReturnState } from "../../../../shared/navigation/home-return-state.js";
import { trySoftOpenReader } from "../../../../shared/navigation/soft-reader.js";

export type ReaderNavigateOptions = {
  replace?: boolean;
};

export type ReaderNavigateFn = (url: string, options?: ReaderNavigateOptions) => void;

const defaultNavigate: ReaderNavigateFn = (url, { replace = false } = {}) => {
  const target = `${url || ""}`.trim();
  if (!target) return;
  // Record scroll position; on soft open main page is not unmounted, still available as fallback
  captureHomeReturnState({ allowBack: !replace });
  // Prefer soft open (when main page SPA is still present, can open even if address bar
  // already shows reader.html)
  if (!replace && trySoftOpenReader(target)) {
    return;
  }
  if (replace) {
    // Deep link start: try soft open first; if failed, hard navigate
    if (trySoftOpenReader(target)) {
      return;
    }
    window.location.replace(target);
    return;
  }
  // Standalone reader pages / cross-page: full page navigation
  window.location.assign(target);
};

let navigateImpl: ReaderNavigateFn = defaultNavigate;

/** Test-only: inject fake navigation; pass null to reset after test */
export function setReaderNavigateForTests(fn: ReaderNavigateFn | null) {
  navigateImpl = fn || defaultNavigate;
}

export function navigateToReader(url: string, options: ReaderNavigateOptions = {}) {
  navigateImpl(url, options);
}



