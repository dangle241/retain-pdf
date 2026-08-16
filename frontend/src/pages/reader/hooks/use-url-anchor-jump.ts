// Neo URL → react-pdf nhảy trang.
//
// Nhảy lại từ mục đã lưu / tìm kiếm / trích dẫn mang ?page_idx=&block_id= trên URL (page_idx bắt đầu từ 0).
// Engine legacy gọi scheduleAnchorJump khi boot; đường react-pdf mặc định trước đây chỉ
// void resolveReaderAnchor(), tức không nhảy. Hook này sau khi PDF sẵn sàng và biết tổng số trang sẽ
// nhảy tới page_idx+1 và thử lại sau độ trễ ngắn để chờ bố cục ô trang.
//
// block_id: react-pdf chưa có tầng region, chỉ nhảy ở cấp trang.

import { useEffect, useRef } from "react";
import { resolveReaderAnchor } from "../external.js";

export type UrlReaderAnchor = {
  pageIdx: number | null;
  blockId: string;
};

/** page_idx (bắt đầu từ 0) → số trang trình đọc (bắt đầu từ 1); không hợp lệ thì trả null. */
export function pageNumberFromUrlAnchor(
  anchor: UrlReaderAnchor | null | undefined,
): number | null {
  if (!anchor) return null;
  // Không dùng Number(null)===0, nếu không trường hợp "chỉ có block_id" sẽ bị hiểu nhầm là trang 1.
  if (anchor.pageIdx === null || anchor.pageIdx === undefined) return null;
  const raw = Number(anchor.pageIdx);
  if (!Number.isFinite(raw)) return null;
  const page = Math.floor(raw) + 1;
  return page >= 1 ? page : null;
}

const JUMP_DELAYS_MS = [0, 80, 200, 400, 800];

/**
 * Khi enabled và numPages khả dụng, nhảy một lần theo neo URL (mỗi phiên một lần).
 */
export function useUrlAnchorJump(options: {
  /** Boot hoàn tất, có thể cuộn. */
  enabled: boolean;
  numPages: number;
  goToPage: (page: number) => void;
}) {
  const { enabled, numPages, goToPage } = options;
  const appliedKeyRef = useRef("");
  const goToPageRef = useRef(goToPage);
  goToPageRef.current = goToPage;

  useEffect(() => {
    if (!enabled || !Number.isFinite(numPages) || numPages < 1) {
      return;
    }

    const anchor = resolveReaderAnchor() as UrlReaderAnchor | null;
    const page = pageNumberFromUrlAnchor(anchor);
    // Không có số trang hợp lệ: coi như đã xử lý để tránh đọc URL lặp về sau.
    const key = page == null
      ? `none:${anchor?.blockId || ""}`
      : `p:${page}`;
    if (appliedKeyRef.current === key) {
      return;
    }
    if (page == null) {
      appliedKeyRef.current = key;
      return;
    }

    appliedKeyRef.current = key;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const delay of JUMP_DELAYS_MS) {
      timers.push(
        setTimeout(() => {
          goToPageRef.current(page);
        }, delay),
      );
    }
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [enabled, numPages]);
}
