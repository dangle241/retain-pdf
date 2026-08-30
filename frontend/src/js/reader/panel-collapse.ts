// Thu gọn cột trái/phải trong bố cục ba cột: tay cầm đổi class thu gọn trên body, đặt chiều rộng cột về 0 và lưu trạng thái.
// Thu gọn chỉ là hình ảnh, không đổi ngăn active của cột phải; nội dung gốc vẫn còn khi mở lại.

const STORAGE_KEY = "retainpdf-reader-collapse-v1";

export function loadCollapseState(storage = globalThis.localStorage || null) {
  const blank = { left: false, right: false };
  if (!storage) {
    return blank;
  }
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") {
      return blank;
    }
    return { left: Boolean(parsed.left), right: Boolean(parsed.right) };
  } catch (_err) {
    return blank;
  }
}

export function saveCollapseState(state, storage = globalThis.localStorage || null) {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ left: Boolean(state.left), right: Boolean(state.right) }));
  } catch (_err) {
    // Hết hạn mức/chế độ riêng tư: thất bại im lặng.
  }
}

export function createReaderPanelCollapse({
  documentRef = globalThis.document,
  storage = globalThis.localStorage || null,
  onChange = null,
} = {}) {
  const body = documentRef?.body || documentRef?.querySelector?.("body");
  const leftBtn = documentRef?.getElementById?.("reader-left-collapse-btn");
  const rightBtn = documentRef?.getElementById?.("reader-right-collapse-btn");
  const state = loadCollapseState(storage);

  function apply() {
    body?.classList?.toggle?.("reader-left-collapsed", state.left);
    body?.classList?.toggle?.("reader-right-collapsed", state.right);
    // aria-expanded phản ánh "cột có mở không"; biểu tượng tay cầm lật theo is-collapsed bằng CSS.
    leftBtn?.setAttribute?.("aria-expanded", state.left ? "false" : "true");
    rightBtn?.setAttribute?.("aria-expanded", state.right ? "false" : "true");
    leftBtn?.classList?.toggle?.("is-collapsed", state.left);
    rightBtn?.classList?.toggle?.("is-collapsed", state.right);
    onChange?.();
  }

  function toggleLeft() {
    state.left = !state.left;
    saveCollapseState(state, storage);
    apply();
  }

  function toggleRight() {
    state.right = !state.right;
    saveCollapseState(state, storage);
    apply();
  }

  // Khi mở công cụ từ thanh trên, cột phải tự mở nếu đang thu gọn để lộ nội dung.
  function expandRight() {
    if (state.right) {
      state.right = false;
      saveCollapseState(state, storage);
      apply();
    }
  }

  function bindEvents() {
    leftBtn?.addEventListener?.("click", toggleLeft);
    rightBtn?.addEventListener?.("click", toggleRight);
    apply();
  }

  return { bindEvents, toggleLeft, toggleRight, expandRight, state: () => ({ ...state }) };
}
