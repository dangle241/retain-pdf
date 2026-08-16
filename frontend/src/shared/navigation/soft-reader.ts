// Trang chủ "mở mềm" trình đọc: không location.assign, dùng history.pushState + lớp toàn màn hình,
// không unmount DOM trang chủ → đóng không làm mới, vị trí cuộn được giữ tự nhiên.
// Thanh địa chỉ đổi thành reader.html?…, nhưng document vẫn là SPA trang chủ.

export const SOFT_READER_HISTORY_FLAG = "retainpdfSoftReader";
export const SOFT_READER_OPEN_EVENT = "retainpdf:soft-reader-open";
export const SOFT_READER_FORCE_CLOSE_EVENT = "retainpdf:soft-reader-force-close";
/** iframe → trang cha: yêu cầu đóng lớp đọc mềm. */
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

/** SPA trang chủ có còn mount hay không (sau mở mềm URL đã là reader.html nhưng #app-shell vẫn còn). */
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
 * Mở mềm trên SPA trang chủ; thành công trả true.
 * Lưu ý: sau mở mềm, location.pathname đổi thành reader.html nhưng document vẫn là trang chủ.
 * Vì vậy không thể chỉ dùng pathname để xác định, nếu không lần mở thứ hai sẽ đi nhầm location.assign → màn hình trắng/chuyển toàn trang.
 */
export function trySoftOpenReader(url: string): boolean {
  if (typeof window === "undefined") return false;
  const target = `${url || ""}`.trim();
  if (!target) return false;

  const onHomePath = isHomeDocumentPath(window.location.pathname);
  const alreadySoft = isSoftReaderHistoryState(window.history.state);
  const spaAlive = isHomeSpaAlive();

  // Chỉ có thể mở mềm khi SPA trang chủ còn tồn tại; reader.html độc lập toàn trang không dùng nhánh này.
  if (!onHomePath && !alreadySoft && !spaAlive) {
    return false;
  }
  // pathname đã là reader.html và SPA đã unmount → giao cho location.assign.
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
    // Đã ở lớp đọc mềm: replace để tránh history chất một chuỗi reader.
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

/** Trang cha nhận yêu cầu đóng: ưu tiên history.back để gỡ lớp mềm. */
export function closeSoftReaderOnHost() {
  if (typeof window === "undefined") return;
  if (isSoftReaderHistoryState(window.history.state)) {
    window.history.back();
    return;
  }
  // Khi không có mục history tương ứng: đổi URL về trang chủ và buộc gỡ lớp.
  try {
    const home = new URL("./index.html", window.location.href);
    // Giữ tiền tố thư mục: /foo/reader.html → /foo/index.html.
    const homePath = home.pathname.replace(/reader\.html$/i, "index.html");
    const href = `${homePath}${home.search}${home.hash}` || "./index.html";
    window.history.replaceState(null, "", href);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(SOFT_READER_FORCE_CLOSE_EVENT));
}
