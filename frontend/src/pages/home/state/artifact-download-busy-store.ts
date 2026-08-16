// Store trạng thái busy của artifact-downloads (phương án hai trong thiết kế Dialog §7.5).
//
// Bối cảnh (thiết kế §0.5): artifact-downloads dùng click ủy quyền cấp document +
// setLinkBusy theo kiểu mệnh lệnh (hệ thống cũ sửa trực tiếp text/class DOM). Nút nằm rải ở
// ResultActions.jsx của recent-jobs và StatusDetailDialog.jsx của miền này; tổ tiên của cả hai (StatusCard/
// bản thân StatusDetailDialog) đều nằm trong chuỗi polling/cập nhật store tần suất cao; nếu trong lúc tải, component cha
// render lại do trường không liên quan thay đổi, diff DOM ảo sẽ nuốt nội dung "Đang tải.../37%" được ghi theo kiểu mệnh lệnh
// và trả nút về nhãn ban đầu. Phương án hai: setLinkBusy không sửa DOM trực tiếp nữa, chỉ ghi store này;
// mỗi component nút đăng ký lát cắt actionId riêng (use-artifact-download-busy.js),
// nhãn hoàn toàn đến từ React state nên render lại không ghi đè (vì chính state là giá trị mới nhất).
//
// Quan hệ với src/js/features/artifact-downloads/download-view-port.js của hệ thống cũ:
// Giữ nguyên file cũ (vẫn để dist/app.bundle.js chưa cutover sử dụng; bản DOM mặc định
// setLinkBusy sửa trực tiếp nội dung <a> thật); composition.js gắn một instance
// viewPort khác cho React, triển khai trực tiếp ba phương thức bằng literal (không import view-port.js/view.js cũ:
// tên của cả hai file đều khớp regex chống hồi quy trong architecture-boundaries.test.mjs,
// src/pages/** bị cấm import); setLinkBusy ghi vào store này.
//
// Hình dạng state: { [actionId]: { busy: true, label } }; không có actionId nào đó nghĩa là hiện tại
// không busy. getState() chỉ đổi tham chiếu cấp cao nhất khi thực sự thay đổi (giống
// pub-sub tối giản trong src/pages/home/state/dialog-store.js), có thể cấp trực tiếp cho
// useSyncExternalStore mà không gây render lại vô hạn (không có vấn đề getSnapshot clone mỗi lần của
// app-framework/store.js).

export type ArtifactBusySlice = {
  busy: boolean;
  label: string;
};

export type ArtifactDownloadBusyState = Record<string, ArtifactBusySlice>;

export type ArtifactDownloadBusyStore = {
  subscribe: (listener: (state: ArtifactDownloadBusyState) => void) => () => void;
  getState: () => ArtifactDownloadBusyState;
  getActionState: (actionId: string) => ArtifactBusySlice;
  setBusy: (actionId: string, busy: boolean, label?: string) => void;
  isBusy: (actionId: string) => boolean;
};

const IDLE: ArtifactBusySlice = Object.freeze({ busy: false, label: "" });

export function createArtifactDownloadBusyStore(): ArtifactDownloadBusyStore {
  let state: ArtifactDownloadBusyState = {};
  const listeners = new Set<(state: ArtifactDownloadBusyState) => void>();

  function notify() {
    listeners.forEach((listener) => listener(state));
  }

  return {
    // Tương thích useSyncExternalStore: subscribe trả về hàm hủy đăng ký.
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getState: () => state,
    // Lấy một lát cắt theo actionId; khi cùng actionId không thay đổi thì trả về cùng tham chiếu đối tượng
    // (setBusy chỉ shallow spread cho actionId không liên quan, không chạm vào
    // tham chiếu giá trị của key khác); kết hợp use-artifact-download-busy.js để render lại chính xác ở cấp nút.
    getActionState(actionId) {
      return state[`${actionId || ""}`.trim()] || IDLE;
    },
    setBusy(actionId, busy, label = "") {
      const id = `${actionId || ""}`.trim();
      if (!id) {
        return;
      }
      if (!busy) {
        if (!(id in state)) {
          return;
        }
        const next = { ...state };
        delete next[id];
        state = next;
        notify();
        return;
      }
      state = { ...state, [id]: { busy: true, label: `${label || ""}` } };
      notify();
    },
    isBusy(actionId) {
      return Boolean(state[`${actionId || ""}`.trim()]?.busy);
    },
  };
}

export const ARTIFACT_DOWNLOAD_BUSY_IDLE = IDLE;
