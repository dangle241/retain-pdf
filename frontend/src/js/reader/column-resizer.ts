// Kéo điều chỉnh chiều rộng cột trái/phải trong bố cục ba cột: kéo pointer trên thanh chia để đổi biến CSS theo thời gian thực, thả ra để lưu.
// Tách tính chiều rộng thuần clampColumnWidth và lưu bền vững load/save để dễ unit test; kéo DOM chỉ là lớp bọc mỏng.

export const READER_COLUMN_LIMITS = {
  left: { min: 180, max: 460, default: 248 },
  right: { min: 300, max: 620, default: 384 },
};

const STORAGE_KEY = "retainpdf-reader-cols-v1";

// Giới hạn thành pixel nguyên trong [min, max]; đầu vào không hợp lệ lùi về default.
export function clampColumnWidth(px, { min, max, default: fallback }) {
  const value = Number(px);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function loadColumnWidths(storage = globalThis.localStorage || null) {
  const defaults = {
    left: READER_COLUMN_LIMITS.left.default,
    right: READER_COLUMN_LIMITS.right.default,
  };
  if (!storage) {
    return defaults;
  }
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") {
      return defaults;
    }
    return {
      left: clampColumnWidth(parsed.left ?? defaults.left, READER_COLUMN_LIMITS.left),
      right: clampColumnWidth(parsed.right ?? defaults.right, READER_COLUMN_LIMITS.right),
    };
  } catch (_err) {
    return defaults;
  }
}

export function saveColumnWidths(widths, storage = globalThis.localStorage || null) {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ left: widths.left, right: widths.right }));
  } catch (_err) {
    // Hết hạn mức/chế độ riêng tư: thất bại im lặng.
  }
}

export function createReaderColumnResizer({
  documentRef = globalThis.document,
  storage = globalThis.localStorage || null,
  onResize = null,
} = {}) {
  const body = documentRef?.body || documentRef?.querySelector?.("body");
  const leftHandle = documentRef?.getElementById?.("reader-col-resizer-left");
  const rightHandle = documentRef?.getElementById?.("reader-col-resizer-right");
  const widths = loadColumnWidths(storage);

  function setVar(name, value) {
    body?.style?.setProperty?.(name, `${value}px`);
  }

  // "Chiều rộng khi mở" của cột trái: CSS suy ra --reader-left-w đã áp dụng từ giá trị này; class ghi đè thành 0 khi thu gọn.
  function applyLeft(px) {
    widths.left = clampColumnWidth(px, READER_COLUMN_LIMITS.left);
    setVar("--reader-left-col", widths.left);
    return widths.left;
  }

  // "Chiều rộng khi mở" của cột phải: cột phải dùng nó với :has(.is-open), khi đóng là 0 (xem CSS).
  function applyRight(px) {
    widths.right = clampColumnWidth(px, READER_COLUMN_LIMITS.right);
    setVar("--reader-right-col", widths.right);
    return widths.right;
  }

  function viewportWidth() {
    return documentRef?.defaultView?.innerWidth
      || globalThis.window?.innerWidth
      || 1280;
  }

  function bindHandle(handle, side) {
    if (!handle?.addEventListener) {
      return;
    }
    let dragging = false;

    function onMove(event) {
      if (!dragging) {
        return;
      }
      const clientX = Number(event.clientX) || 0;
      if (side === "left") {
        applyLeft(clientX);
      } else {
        applyRight(viewportWidth() - clientX);
      }
      onResize?.();
    }

    function onUp(event) {
      if (!dragging) {
        return;
      }
      dragging = false;
      body?.classList?.remove?.("reader-resizing");
      handle.releasePointerCapture?.(event.pointerId);
      documentRef?.removeEventListener?.("pointermove", onMove);
      documentRef?.removeEventListener?.("pointerup", onUp);
      saveColumnWidths(widths, storage);
      onResize?.();
    }

    handle.addEventListener("pointerdown", (event) => {
      dragging = true;
      body?.classList?.add?.("reader-resizing");
      handle.setPointerCapture?.(event.pointerId);
      documentRef?.addEventListener?.("pointermove", onMove);
      documentRef?.addEventListener?.("pointerup", onUp);
      event.preventDefault?.();
    });

    // Bấm đúp thanh chia: khôi phục chiều rộng mặc định của cột.
    handle.addEventListener("dblclick", () => {
      if (side === "left") {
        applyLeft(READER_COLUMN_LIMITS.left.default);
      } else {
        applyRight(READER_COLUMN_LIMITS.right.default);
      }
      saveColumnWidths(widths, storage);
      onResize?.();
    });
  }

  function bindEvents() {
    applyLeft(widths.left);
    applyRight(widths.right);
    bindHandle(leftHandle, "left");
    bindHandle(rightHandle, "right");
  }

  return { bindEvents, applyLeft, applyRight, widths: () => ({ ...widths }) };
}
