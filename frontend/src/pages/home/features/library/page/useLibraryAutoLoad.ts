// Tự tải khi cuộn lưới thư viện (bản thiết kế §2 features/library/).
//
// Kiểm tra hình học viết lại từ shouldAutoLoadRecentJobs của host-actions.js (ngưỡng 260px / 0.35);
// không import vì tệp cũ thuộc danh sách "chết, xóa khi cutover"; theo bản thiết kế viết lại tại chỗ khoảng
// 10 dòng thay vì dùng lại. Có hai entry kích hoạt cùng hội tụ vào check():
// 1. Listener passive scroll của container khi người dùng cuộn tới đáy;
// 2. scheduleAutoLoadIfNeeded được refresh-scheduler.js gọi sau mỗi commit phân trang →
//    viewPort.scheduleAutoLoadCheck({isSuspended}), được nối qua
//    registerAutoLoadChecker của react-view-port.js; sau khi nội dung đổi, nếu
//    chưa đầy màn hình thì tiếp tục tự tải trang sau.
//
// Lệnh gọi loadMore thống nhất qua viewPort.handlersRef.current.onLoadMore; bindings.js
// bind () => runtime.loadRecentJobs({reset:false}), không gọi trực tiếp
// runtime; giữ cùng luồng với nút "Thêm", tránh hai entry tải song song.

import { useCallback, useEffect } from "react";

const THRESHOLD_PX = 260;
const THRESHOLD_RATIO = 0.35;

export function useLibraryAutoLoad({ scrollBodyRef, hasMore, loadMoreLoading, viewPort }: any) {
  const check = useCallback(({ isSuspended }: any = {}) => {
    if (isSuspended?.() ?? viewPort.handlersRef.current.isSuspended?.()) {
      return;
    }
    if (!hasMore || loadMoreLoading) {
      return;
    }
    const scrollBody = scrollBodyRef.current;
    if (!scrollBody) {
      return;
    }
    const remaining = scrollBody.scrollHeight - scrollBody.scrollTop - scrollBody.clientHeight;
    const threshold = Math.max(THRESHOLD_PX, scrollBody.clientHeight * THRESHOLD_RATIO);
    if (remaining < threshold) {
      viewPort.handlersRef.current.onLoadMore?.();
    }
  }, [hasMore, loadMoreLoading, scrollBodyRef, viewPort]);

  // Nối chuỗi gọi refresh-scheduler.js → viewPort.scheduleAutoLoadCheck.
  useEffect(() => viewPort.registerAutoLoadChecker(check), [viewPort, check]);

  // Listener passive của chính container cuộn.
  useEffect(() => {
    const scrollBody = scrollBodyRef.current;
    if (!scrollBody) {
      return undefined;
    }
    const onScroll = () => {
      if (viewPort.handlersRef.current.isSuspended?.()) {
        return;
      }
      requestAnimationFrame(() => check());
    };
    scrollBody.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollBody.removeEventListener("scroll", onScroll);
  }, [scrollBodyRef, viewPort, check]);
}
