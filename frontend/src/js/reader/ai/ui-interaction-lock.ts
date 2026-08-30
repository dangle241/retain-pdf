// Cách ly ngắn khi chuyển/tạo nhánh hội thoại AI để lần bấm không xuyên tới PDF/liên kết sau khi danh sách thu gọn.
// Chỉ có hiệu lực trong cửa sổ lock, không bao giờ chặn vĩnh viễn entry đọc hoặc điều hướng bình thường.

let lockUntil = 0;
let shieldCleanup: (() => void) | null = null;
let overlayEl: HTMLDivElement | null = null;
let openGuardInstalled = false;

export function isReaderAiNavigationLocked(now = Date.now()): boolean {
  return now < lockUntil;
}

export function lockReaderAiNavigation(durationMs = 700): void {
  const until = Date.now() + Math.max(0, durationMs);
  if (until > lockUntil) lockUntil = until;
}

/** Buộc bỏ cách ly khi vào trang/lỗi để tránh lớp phủ còn sót làm không bấm được. */
export function clearReaderAiNavigationLock(): void {
  lockUntil = 0;
  shieldCleanup?.();
  shieldCleanup = null;
  removeOverlay();
}

function ensureOverlay(): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  if (overlayEl && overlayEl.isConnected) return overlayEl;
  const el = document.createElement("div");
  el.setAttribute("data-reader-ai-pointer-shield", "1");
  el.setAttribute("aria-hidden", "true");
  Object.assign(el.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483000",
    cursor: "progress",
    background: "transparent",
    pointerEvents: "auto",
    touchAction: "none",
  } as CSSStyleDeclaration);
  const block = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    (event as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
  };
  for (const type of [
    "pointerdown",
    "pointerup",
    "mousedown",
    "mouseup",
    "click",
    "auxclick",
    "dblclick",
    "contextmenu",
    "touchstart",
    "touchend",
  ] as const) {
    el.addEventListener(type, block, { capture: true, passive: false });
  }
  document.documentElement.appendChild(el);
  overlayEl = el;
  return el;
}

function removeOverlay(): void {
  if (!overlayEl) return;
  try {
    overlayEl.remove();
  } catch {
    // ignore
  }
  overlayEl = null;
}

/**
 * Trong thời gian ngắn, nuốt pointer toàn màn hình và cấm chuyển trang/mở liên kết.
 * Chỉ dùng khi chuyển/tạo nhánh ở thanh hội thoại AI; thời lượng nên ngắn nhất có thể.
 */
export function armReaderAiClickShield(
  durationMs = 700,
  options: { overlayDelayMs?: number } = {},
): void {
  lockReaderAiNavigation(durationMs);
  if (typeof document === "undefined") return;

  shieldCleanup?.();
  shieldCleanup = null;

  const until = Date.now() + Math.max(0, durationMs);
  const overlayDelay = Math.max(0, Number(options.overlayDelayMs) || 0);
  let overlayTimer: ReturnType<typeof setTimeout> | null = null;

  if (overlayDelay === 0) {
    ensureOverlay();
  } else {
    overlayTimer = setTimeout(() => {
      overlayTimer = null;
      if (Date.now() < until) ensureOverlay();
    }, overlayDelay);
  }

  const swallow = (event: Event) => {
    if (Date.now() >= until) {
      teardown();
      return;
    }
    const target = event.target;
    // Cho phép thanh hội thoại / thanh thao tác câu trả lời (nút mở hội thoại mới) để vẫn bấm được sau khi pointerdown khóa.
    if (
      target instanceof Element
      && target.closest(
        "[data-reader-ai-sessions], [data-reader-ai-actions], .aui-action-btn-branch",
      )
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    (event as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
  };

  const opts: AddEventListenerOptions = { capture: true, passive: false };
  const types = ["click", "auxclick", "dblclick", "pointerup", "mouseup"] as const;

  const teardown = () => {
    if (overlayTimer != null) {
      clearTimeout(overlayTimer);
      overlayTimer = null;
    }
    for (const type of types) {
      document.removeEventListener(type, swallow, opts);
    }
    removeOverlay();
    if (shieldCleanup === teardown) shieldCleanup = null;
  };

  for (const type of types) {
    document.addEventListener(type, swallow, opts);
  }
  shieldCleanup = teardown;
  window.setTimeout(teardown, Math.max(0, durationMs) + 48);
}

export function shouldIgnoreReaderAiNavEvent(event: Event | null | undefined): boolean {
  if (isReaderAiNavigationLocked()) return true;
  if (!event) return false;
  // Guard typeof: node/jsdom không có MouseEvent toàn cục; instanceof trực tiếp sẽ ném
  // ReferenceError và bị listener sự kiện âm thầm nuốt (test answer-enhance
  // từng thất bại giả vì nút được chèn thành công nhưng onJump không bao giờ chạy).
  if (typeof MouseEvent !== "undefined" && event instanceof MouseEvent && event.isTrusted === false) {
    return true;
  }
  return false;
}

/**
 * Chỉ chặn window.open / hành vi mặc định của liên kết trong thời gian khóa điều hướng AI.
 * Không cấm vĩnh viễn điều hướng cùng nguồn để không phá thao tác mở đọc bình thường.
 */
export function installReaderWindowOpenGuard(): () => void {
  if (typeof window === "undefined" || typeof window.open !== "function") {
    return () => {};
  }
  if (openGuardInstalled) return () => {};
  openGuardInstalled = true;

  // Khi vào trang, xóa lớp phủ còn sót trước.
  clearReaderAiNavigationLock();

  const original = window.open.bind(window);
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    // Chỉ từ chối trong thời gian khóa do bấm nhầm khi chuyển hội thoại; bình thường không chặn.
    if (isReaderAiNavigationLocked()) {
      return null;
    }
    return original(url as string, target, features);
  }) as typeof window.open;

  const onClickCapture = (event: Event) => {
    if (!isReaderAiNavigationLocked()) return;
    const t = event.target;
    if (!(t instanceof Element)) return;
    // Cho phép chính thanh hội thoại.
    if (t.closest("[data-reader-ai-sessions]")) return;
    const a = t.closest("a[href]");
    if (a) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  document.addEventListener("click", onClickCapture, true);

  return () => {
    window.open = original;
    document.removeEventListener("click", onClickCapture, true);
    openGuardInstalled = false;
    clearReaderAiNavigationLock();
  };
}
