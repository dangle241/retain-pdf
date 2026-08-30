// Điểm vào trình đọc: chuyển openReaderRequested / deep link thành điều hướng.
//
// Mặc định dùng soft open (navigate-to-reader → lớp toàn màn hình SoftReaderHost), không unmount trang chủ;
// Deep link có replace vẫn tải trực tiếp reader.html.

import { useEffect } from "react";
import { useAppEvent } from "../../../../shared/react/use-app-event.js";
import {
  APP_EVENTS,
  buildReaderDocumentPageUrl,
  buildReaderPageUrl,
  requestedReaderJobIdFromLocation,
} from "../../composition/external.js";
import { navigateToReader } from "./navigate-to-reader.js";

function anchorFromEventDetail(detail: any = {}) {
  const rawPageIdx = detail.pageIdx;
  const pageIdx = rawPageIdx === null || rawPageIdx === undefined ? NaN : Number(rawPageIdx);
  const blockId = `${detail.blockId || ""}`.trim();
  if (!Number.isFinite(pageIdx) && !blockId) {
    return null;
  }
  return {
    pageIdx: Number.isFinite(pageIdx) ? pageIdx : null,
    blockId,
  };
}

/**
 * Không có UI: chỉ chuyển sự kiện "mở trình đọc" / deep link thành điều hướng tới reader.html.
 * Giữ tên component ReaderDialog để tránh thay đổi hàng loạt import trong HomeApp / kiểm thử.
 */
export function ReaderDialog() {
  useAppEvent(APP_EVENTS.openReaderRequested, (event) => {
    const detail = event?.detail || {};
    const jobId = `${detail.jobId || ""}`.trim();
    const anchor = anchorFromEventDetail(detail);
    if (jobId) {
      const url = buildReaderPageUrl(jobId, anchor);
      navigateToReader(url);
      return;
    }
    const documentId = `${detail.documentId || ""}`.trim();
    if (!documentId) {
      return;
    }
    const url = buildReaderDocumentPageUrl(documentId, anchor);
    navigateToReader(url);
  });

  // Deep link trang chủ ?view=reader&job_id= → vào thẳng trang đọc (replace để tránh vòng lặp khi quay lại).
  useEffect(() => {
    const startupJobId = requestedReaderJobIdFromLocation();
    if (!startupJobId) {
      return;
    }
    const url = buildReaderPageUrl(startupJobId, null);
    navigateToReader(url, { replace: true });
  }, []);

  return null;
}
