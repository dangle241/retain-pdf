// "Soft open" Reader from main page: don't use location.assign; use history.pushState + full‑screen layer.
// Main page DOM is not unmounted → close doesn't refresh, scroll position persists.
// URL bar becomes reader.html?... but document is still the main page SPA.

export const SOFT_READER_HISTORY_FLAG = "retainpdfSoftReader";
export const SOFT_READER_OPEN_EVENT = "retainpdf:soft-reader-open";
export const SOFT_READER_FORCE_CLOSE_EVENT = "retainpdf:soft-reader-force-close";
/** iframe → parent page: request to close soft reader layer */
export const SOFT_READER_CLOSE_MESSAGE = "retainpdf:soft-reader-close";

export type SoftReaderHistoryState = {
  [SOFT_READER_HISTORY_FLAG]?: boolean;
  readerUrl?: string;
};

export function isHomeDocumentPath(pathname = ""): boolean {
  const p = `${pathname || ""}`;
  if (/reader\.html/i.test(p)) return false;
  if (/detail\.html/i.test(p)) return false;
  return true;
}

export function isSoftReaderHistoryState(state: unknown): state is SoftReaderHistoryState {
  return Boolean(
    state
    && typeof state === "object"
    && (state as SoftReaderHistoryState)[SOFT_READER_HISTORY_FLAG],
  );
}

/** Whether the main page SPA is still mounted (after soft open, URL is reader.html but #app‑shell is still there) */
export function isHomeSpaAlive(doc: Document = globalThis.document): boolean {
  if (typeof doc === "undefined" || !doc) return false;
  return Boolean(
    doc.getElementById("app-shell")
    || doc.querySelector(".app-shell")
    || doc.getElementById("soft-reader-host")
    || doc.querySelector("[data-home-spa]"),
  );
}

/**
 * Soft open on the main page SPA; returns true on success.
 * Note: after soft open, location.pathname becomes reader.html, but document is still the main page.
 * So don't rely solely on pathname; otherwise the second open will mistakenly use location.assign → white screen / full page reload.
 */
export function trySoftOpenReader(url: string): boolean {
  if (typeof window === "undefined") return false;
  const target = `${url || ""}`.trim();
  if (!target) return false;

  const onHomePath = isHomeDocumentPath(window.location.pathname);
  const alreadySoft = isSoftReaderHistoryState(window.history.state);
  const spaAlive = isHomeSpaAlive();

  // Soft open only possible when main page SPA is still mounted; standalone reader.html full page doesn't go through this path
  if (!onHomePath && !alreadySoft && !spaAlive) {
    return false;
  }
  // pathname is already reader.html and SPA is unmounted → hand over to location.assign
  if (!spaAlive && !onHomePath) {
    return false;
  }

  try {
    const absolute = new URL(target, window.location.href).href;
    if (new URL(absolute).origin !== window.location.origin) {
      return false;
    }
    const state: SoftReaderHistoryState = {
      [SOFT_READER_HISTORY_FLAG]: true,
      readerUrl: absolute,
    };
    // Already in soft reader: replace, avoid stacking many reader entries in history
    if (alreadySoft || (!onHomePath && spaAlive)) {
      window.history.replaceState(state, "", absolute);
    } else {
      window.history.pushState(state, "", absolute);
    }
    window.dispatchEvent(
      new CustomEvent(SOFT_READER_OPEN_EVENT, {
        detail: { url: absolute, nonce: Date.now() },
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Parent page receives close request: prefer history.back to remove the soft layer */
export function closeSoftReaderOnHost() {
  if (typeof window === "undefined") return;
  if (isSoftReaderHistoryState(window.history.state)) {
    window.history.back();
    return;
  }
  // When there's no corresponding history entry: rewrite URL to main page and force layer removal
  try {
    const home = new URL("./index.html", window.location.href);
    // Preserve directory prefix: /foo/reader.html → /foo/index.html
    const homePath = home.pathname.replace(/reader\.html$/i, "index.html");
    const href = `${homePath}${home.search}${home.hash}` || "./index.html";
    window.history.replaceState(null, "", href);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(SOFT_READER_FORCE_CLOSE_EVENT));
}




