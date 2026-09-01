// 阅读入口：把 openReaderRequested / 深链 转成导航。
//
// 默认走 soft open（navigate-to-reader → SoftReaderHost 全屏层），主页不卸载；
// 深链 replace 仍硬进 reader.html。

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
 * 无 UI：只负责把「打开阅读」事件 / 深链 转成跳转 reader.html。
 * 组件名保留 ReaderDialog，避免 HomeApp / 测试 import 大面积改动。
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

  // 主页深链 ?view=reader&job_id= → 直接进阅读页（replace，避免返回死循环）
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
