// Hợp đồng id/trạng thái của AppUpdateBanner (bản thiết kế §5 + §0.1).
//
// Sao chép từ src/js/components/layout/app-update-dom-contract.js (lớp view phần tử tùy chỉnh cũ;
// cổng architecture-boundaries cấm src/pages/** import trực tiếp
// js/components/**); cùng cách này đã được dùng ở giai đoạn 3a trong
// src/pages/home/features/app-shell/app-update-contract.js (lúc đó chỉ
// cần IDS và khung dialog chi tiết tạm gắn trong AppShellHeader.jsx). Tệp này bổ sung
// STATES/CLASSES và là nguồn duy nhất cho miền app-update 3b (nút + dialog chi tiết hợp nhất vào
// AppUpdateBanner.jsx); bản sao cục bộ 3a bị xóa cùng template cũ của AppShellHeader,
// không để lại hai hợp đồng trùng.

export const APP_UPDATE_IDS = Object.freeze({
  button: "app-update-btn",
  dialog: "app-update-dialog",
  status: "app-update-status",
  checkButton: "app-update-check-btn",
});

export const APP_UPDATE_STATES = Object.freeze({
  checking: "checking",
  idle: "idle",
  available: "available",
  latest: "latest",
  error: "error",
});

export const APP_UPDATE_CLASSES = Object.freeze({
  hidden: "hidden",
  hasUpdate: "has-update",
});
