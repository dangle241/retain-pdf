// Nguồn trạng thái đóng/mở của bốn drawer (favorites/annotations/markdown/ai): một active duy nhất, chuyển loại trừ nhau.
// Thay ngữ nghĩa trạng thái của src/js/reader/side-drawers.js cũ; thao tác ghi DOM (is-open/inert/aria-expanded)
// chuyển sang component React đăng ký và render; phía sử dụng mệnh lệnh (ai-context, selection-favorites, điều phối boot)
// vẫn dùng cùng store làm drawerController (giữ nguyên chữ ký open/toggle/close).
//
// Giữ nguyên ngữ nghĩa (giống side-drawers cũ):
// - Mỗi lần gọi open/toggle/close đều thông báo bên đăng ký (dù active không đổi); sync() cũ chạy vô điều kiện,
//   phía nhận onActiveChanged (scheduleScaleRefresh, v.v.) phụ thuộc nhịp "lần nào cũng tới" này.
// - close(name): chỉ xóa khi không truyền name hoặc name đúng bằng active hiện tại.

export type DrawerActiveListener = (active: string) => void;

export function createReaderDrawerStore() {
  let active = "";
  const listeners = new Set<DrawerActiveListener>();

  function notify() {
    listeners.forEach((listener) => listener(active));
  }

  return {
    // Tương thích useSyncExternalStore: subscribe trả về hàm hủy đăng ký; listener nhận active theo tham số.
    subscribe(listener: DrawerActiveListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getActive: () => active,
    active: () => active,
    open(name) {
      active = name;
      notify();
      return active;
    },
    toggle(name) {
      active = active === name ? "" : name;
      notify();
      return active;
    },
    close(name = "") {
      if (!name || active === name) {
        active = "";
      }
      notify();
      return active;
    },
  };
}
