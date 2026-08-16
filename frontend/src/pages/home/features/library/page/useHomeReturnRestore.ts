// Sau khi từ trình đọc về trang chính: khôi phục vị trí cuộn tab.
// - bfcache (pageshow.persisted): DOM còn nguyên, chỉ cần xóa pending
// - Reload thường: chỉ áp dụng cuộn sau khi danh sách có dữ liệu, tránh ghi scrollTop khi chiều cao 0

import { useEffect, useRef } from "react";
import {
  applyHomeReturnScroll,
  clearHomeReturnState,
  consumeHomeReturnState,
  peekHomeReturnState,
  type HomeReturnState,
} from "../../../../../shared/navigation/home-return-state.js";

export function readInitialLibraryTabFromReturn(): string {
  const state = peekHomeReturnState();
  const tab = `${state?.activeTab || ""}`;
  if (
    tab === "categories"
    || tab === "favorites"
    || tab === "library"
    || tab === "ask"
  ) {
    return tab;
  }
  return "library";
}

/**
 * @param ready Chỉ khôi phục cuộn khi danh sách thư viện có nội dung hoặc view bộ sưu tập/đã lưu đã gắn.
 */
export function useHomeReturnRestore(ready: boolean) {
  const restoredRef = useRef(false);

  // bfcache: toàn trang thức dậy từ cache và cuộn đã còn; bỏ pending để tránh nhảy lần hai.
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        clearHomeReturnState();
        restoredRef.current = true;
      }
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    if (!ready || restoredRef.current) return;

    let state: HomeReturnState | null = peekHomeReturnState();
    if (!state) {
      restoredRef.current = true;
      return;
    }
    // Xóa cả khi không có vị trí cuộn hợp lệ để tránh dữ liệu bẩn.
    if (
      state.libraryScrollTop <= 0
      && state.panelScrollTop <= 0
      && state.windowScrollY <= 0
    ) {
      clearHomeReturnState();
      restoredRef.current = true;
      return;
    }

    restoredRef.current = true;
    state = consumeHomeReturnState();
    if (!state) return;

    // Hai rAF: chờ bố cục / chỗ giữ ảnh rồi đặt scrollTop.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applyHomeReturnScroll(state!);
        // Bổ sung một lần khi danh sách tăng chiều cao bất đồng bộ.
        window.setTimeout(() => applyHomeReturnScroll(state!), 80);
        window.setTimeout(() => applyHomeReturnScroll(state!), 320);
      });
    });
  }, [ready]);
}
