// Điều hướng trang chủ → trang đọc (có thể inject để dễ kiểm thử).
//
// Mặc định "mở mềm": history.pushState + lớp toàn màn hình SoftReaderHost, không unmount trang chủ.
// replace / tài liệu ngoài trang chủ / khác origin: vẫn dùng location.replace|assign.

import { captureHomeReturnState } from "../../../../shared/navigation/home-return-state.js";
import { trySoftOpenReader } from "../../../../shared/navigation/soft-reader.js";

export type ReaderNavigateOptions = {
  replace?: boolean;
};

export type ReaderNavigateFn = (url: string, options?: ReaderNavigateOptions) => void;

const defaultNavigate: ReaderNavigateFn = (url, { replace = false } = {}) => {
  const target = `${url || ""}`.trim();
  if (!target) return;
  // Ghi lại vị trí cuộn; khi mở mềm, trang chủ vốn không unmount nhưng đây vẫn là phương án dự phòng.
  captureHomeReturnState({ allowBack: !replace });
  // Ưu tiên mở mềm (khi SPA trang chủ còn tồn tại, vẫn có thể mở lại dù thanh địa chỉ đã là reader.html).
  if (!replace && trySoftOpenReader(target)) {
    return;
  }
  if (replace) {
    // Khởi động từ deep link: cố gắng mở mềm; nếu thất bại mới chuyển trang hoàn toàn.
    if (trySoftOpenReader(target)) {
      return;
    }
    window.location.replace(target);
    return;
  }
  // Trang reader độc lập / chuyển trang: tải toàn bộ trang.
  window.location.assign(target);
};

let navigateImpl: ReaderNavigateFn = defaultNavigate;

/** Chỉ dùng khi kiểm thử: inject điều hướng giả, truyền null để đặt lại sau khi kiểm thử. */
export function setReaderNavigateForTests(fn: ReaderNavigateFn | null) {
  navigateImpl = fn || defaultNavigate;
}

export function navigateToReader(url: string, options: ReaderNavigateOptions = {}) {
  navigateImpl(url, options);
}
