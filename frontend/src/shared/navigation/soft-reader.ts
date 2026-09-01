// 主pages"软打开"Reader: 不 location.assign, 用 history.pushState + 全屏层, 
// 主pages DOM 不卸载 → Close不刷新, 滚动天然保留.
// 地址栏会变成 reader.html?..., 但 document 仍yes主pages SPA.

export const SOFT_READER_HISTORY_FLAG = "retainpdfSoftReader";
export const SOFT_READER_OPEN_EVENT = "retainpdf:soft-reader-open";
export const SOFT_READER_FORCE_CLOSE_EVENT = "retainpdf:soft-reader-force-close";
/** iframe → 父pages: 请求Close软阅读层 */
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

/** 主pages SPA yesno仍挂着(软打开后 URL 已yes reader.html, 但 #app-shell 还在) */
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
 * 在主pages SPA 上软打开；成功返回 true.
 * 注意: 软打开后 location.pathname 会变成 reader.html, 但 document 仍yes主pages.
 * 因此不能只用 pathname 判断, no则第二次打开会误走 location.assign → 白屏/整pages跳.
 */
export function trySoftOpenReader(url: string): boolean {
  if (typeof window === "undefined") return false;
  const target = `${url || ""}`.trim();
  if (!target) return false;

  const onHomePath = isHomeDocumentPath(window.location.pathname);
  const alreadySoft = isSoftReaderHistoryState(window.history.state);
  const spaAlive = isHomeSpaAlive();

  // 仅当主pages SPA 还在时才能软开；独立打开的 reader.html 整pages不走这entries
  if (!onHomePath && !alreadySoft && !spaAlive) {
    return false;
  }
  // pathname 已yes reader.html 且 SPA 已卸掉 → 交给 location.assign
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
    // 已在软阅读层: replace, 避免 history 堆一串 reader
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

/** 父pages收到Close请求: 优先 history.back 卸掉软层 */
export function closeSoftReaderOnHost() {
  if (typeof window === "undefined") return;
  if (isSoftReaderHistoryState(window.history.state)) {
    window.history.back();
    return;
  }
  // None对应 history entries目时: URL 改回主pages并强制卸层
  try {
    const home = new URL("./index.html", window.location.href);
    // 保留目录前缀: /foo/reader.html → /foo/index.html
    const homePath = home.pathname.replace(/reader\.html$/i, "index.html");
    const href = `${homePath}${home.search}${home.hash}` || "./index.html";
    window.history.replaceState(null, "", href);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(SOFT_READER_FORCE_CLOSE_EVENT));
}




