// Host toast tiến độ tải xuống (giai đoạn B: chuyển đổi shadcn, loại bỏ ba bản giống từng byte của
// DownloadToastHost.jsx được sao chép; đã xóa ba file cũ ở home/reader/detail,
// tất cả chuyển sang dùng một triển khai chung này).
//
// Hợp đồng giao diện không đổi: chi tiết triển khai riêng của src/js/utils/download-feedback.js
// `document.querySelector("download-toast").setState(state)/.hide()`——
// không nằm trong phạm vi chuyển đổi này; không phía gọi nào khác phụ thuộc trực tiếp cấu trúc DOM, chỉ dùng gián tiếp qua
// showDownloadToast/showDownloadPreparing/updateDownloadProgress/
// các hàm xuất completeDownloadToast/failDownloadToast; vì vậy tại đây
// tiếp tục render phần tử placeholder `<download-toast>` và gắn phương thức setState/hide (cùng kỹ thuật ref với ba
// file cũ), phía sử dụng không cần sửa.
//
// Render bên trong đổi sang Sonner (<Toaster/> trong src/components/ui/sonner.jsx):
// setState/hide không còn querySelector thủ công để sửa nội dung DOM mà gọi Sonner.
// toast.custom(..., { id: TOAST_ID, duration: Infinity }) / toast.dismiss(...)。
// Cấu trúc/ID bên trong thẻ (#download-toast-title, v.v.)/class (download-toast-card, v.v.)
// được giữ nguyên (tests/artifact-downloads-react.test.mjs assert nội dung tiêu đề toast theo ID,
// và giao diện tái sử dụng CSS hiện có, không nhận giao diện mặc định Sonner); chỉ định vị fixed/tầng/
// hoạt ảnh xuất hiện bên ngoài giao cho <Toaster/> của Sonner (quy tắc định vị fixed của vỏ download-toast trong
// src/styles/components.utilities.css đã ngừng dùng; xem comment file đó để biết lý do).
// Sonner mặc định không áp giao diện thẻ riêng lên nội dung do toast.custom() render
// (data-styled phụ thuộc toast.jsx có tồn tại hay không; xem mã nguồn node_modules/sonner),
// vì vậy hai hệ giao diện không xung đột.

import { useCallback } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner.jsx";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "download-toast": any;
    }
  }
}

const TOAST_ID = "download-toast";

function DownloadToastCard({
  title = "Đang tải xuống",
  status = "Đang chuẩn bị...",
  meta = "Đang chờ phản hồi...",
  percent = NaN,
  tone = "progress",
}) {
  const width = Number.isFinite(percent)
    ? Math.max(4, Math.min(100, Number(percent) || 0))
    : 18;
  return (
    <div className="download-toast-card" data-tone={tone} aria-live="polite">
      <div className="download-toast-head">
        <div id="download-toast-title" className="download-toast-title">{title}</div>
        <div id="download-toast-status" className="download-toast-status">{status}</div>
      </div>
      <div className="download-toast-track">
        <span id="download-toast-bar" className="download-toast-bar" style={{ width: `${width}%` }} />
      </div>
      <div id="download-toast-meta" className="download-toast-meta">{meta}</div>
    </div>
  );
}

function applyToastState(state: any = {}) {
  const {
    visible = false,
    title = "Đang tải xuống",
    status = "Đang chuẩn bị...",
    meta = "Đang chờ phản hồi...",
    percent = NaN,
    tone = "progress",
  } = state;
  if (!visible) {
    toast.dismiss(TOAST_ID);
    return;
  }
  toast.custom(
    () => <DownloadToastCard title={title} status={status} meta={meta} percent={percent} tone={tone} />,
    { id: TOAST_ID, duration: Infinity },
  );
}

export function DownloadToastHost() {
  const attach = useCallback((host) => {
    if (!host) {
      return;
    }
    host.setState = applyToastState;
    host.hide = () => toast.dismiss(TOAST_ID);
  }, []);

  return (
    <>
      <Toaster position="bottom-right" />
      {/* Placeholder truy vấn của download-feedback.js, không tham gia render (Sonner phụ trách UI thực sự hiển thị). */}
      <download-toast style={{ display: "none" }} aria-hidden="true" ref={attach} />
    </>
  );
}
