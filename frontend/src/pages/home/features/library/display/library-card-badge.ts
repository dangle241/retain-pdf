// Huy hiệu trạng thái cuối ở góc trên phải thẻ giá sách.
// Khi đang chạy (xếp hàng/OCR/dịch/kết xuất), không ghi nội dung vào huy hiệu góc vì dễ bị cắt; dùng hoạt ảnh loading giữa bìa.

import type { LibraryCardBadge, LibraryCardItem } from "../types.js";
import {
  isRecentJobActive,
  stageKeyForRecentJobLabel,
  isLibraryOnlyItem,
} from "../../../composition/external.js";

/**
 * @returns Huy hiệu trạng thái cuối/thư viện; đang chạy trả null và dùng loading giữa.
 */
export function libraryCardBadge(item: LibraryCardItem = {}): LibraryCardBadge | null {
  if (isLibraryOnlyItem(item)) {
    return {
      label: "Thư viện",
      icon: "archive",
      cls: "border border-border bg-white/95 text-muted-foreground",
    };
  }

  const status = `${item.status || ""}`.trim().toLowerCase();
  const stageKey = stageKeyForRecentJobLabel(item);

  if (status === "failed" || stageKey === "failed") {
    return {
      label: "Thất bại",
      icon: "alert",
      cls: "bg-destructive/12 text-destructive",
    };
  }
  if (status === "canceled" || status === "cancelled" || stageKey === "canceled") {
    return {
      label: "Đã hủy",
      icon: "clock",
      cls: "bg-muted text-muted-foreground",
    };
  }

  // Đang chạy, gồm thử lại: không huy hiệu góc, loading giữa bìa.
  if (isLibraryCardProcessing(item)) {
    return null;
  }

  // Đã hoàn tất
  if (status === "succeeded" || stageKey === "done") {
    return {
      label: "Đã dịch",
      icon: "languages",
      cls: "bg-primary text-primary-foreground",
    };
  }

  // Xếp hàng / đang chạy (dự phòng).
  if (isRecentJobActive(item) || status === "queued" || status === "running") {
    return null;
  }

  // Dự phòng: có giai đoạn done.
  if (stageKey === "done") {
    return {
      label: "Đã dịch",
      icon: "languages",
      cls: "bg-primary text-primary-foreground",
    };
  }

  return null;
}

/** Có nên hiển thị hoạt ảnh đang xử lý giữa bìa không. */
export function isLibraryCardProcessing(item: LibraryCardItem = {}): boolean {
  if (isLibraryOnlyItem(item)) return false;
  const status = `${item.status || ""}`.trim().toLowerCase();
  if (status === "failed" || status === "canceled" || status === "cancelled") {
    return false;
  }
  // Rõ ràng đang chạy.
  if (status === "queued" || status === "running" || status === "pending") {
    return true;
  }
  // Sau thử lại đôi khi status chưa đổi kịp nhưng stage đã quay về ocr/dịch/kết xuất.
  const stage = stageKeyForRecentJobLabel(item);
  if (["ocr", "translate", "render", "queued"].includes(stage)) {
    // succeeded + stage=done là hoàn tất thật; succeeded + stage=ocr là trạng thái bẩn khi thử lại → vẫn xoay.
    if (status === "succeeded" && stage === "done") return false;
    if (status === "succeeded" || status === "") return true;
  }
  if (status === "succeeded" || stage === "done") return false;
  return isRecentJobActive(item);
}
