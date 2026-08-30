// Liên kết nút "Tiếp tục từ điểm dừng/Chạy lại" của tab thất bại (thiết kế §1.2). resume-actions.js
// (được giữ lại) đã tính enabled/status và ghi vào overview.rerun; tại đây chỉ
// tổ hợp disabled = !enabled || rerunPending và phân phát click, không tính lại.

export function useRerunAction({ overview, rerunPending, controller }) {
  const rerun = overview.rerun || { enabled: false, status: "" };
  return {
    enabled: Boolean(rerun.enabled),
    status: rerun.status || "",
    disabled: !rerun.enabled || Boolean(rerunPending),
    run: () => controller.rerunCurrentJob(),
  };
}
