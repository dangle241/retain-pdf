// 详情"Translation"Tab: pages码Scope + Start translation + 静默 attachJobProgress.
// Progress只在 bd-job-status-inner, 不打开工作流弹窗.

import { useEffect, useState } from "react";

/**
 * @param {object} options
 * @param {boolean} options.open
 * @param {string} options.documentId
 * @param {number} options.pageCount
 * @param {object} options.actions library.actions(含 attachJobProgress / translateDocument)
 * @param {(key: string, fn: Function, fail: string) => Promise<void>} options.withBusy
 * @param {(msg: string) => void} options.setError
 * @param {() => void} [options.onTranslateStarted] 成功提交后切到Translation Tab 等
 */
export function useBookDetailTranslate({
  open,
  documentId,
  pageCount,
  actions,
  withBusy,
  setError,
  onTranslateStarted,
}: any) {
  const [rangeOn, setRangeOn] = useState(false);
  const [startPage, setStartPage] = useState("1");
  const [endPage, setEndPage] = useState("");

  useEffect(() => {
    if (!open) {
      setRangeOn(false);
      setStartPage("1");
      setEndPage("");
    }
  }, [open, documentId]);

  useEffect(() => {
    if (pageCount && !endPage) {
      setEndPage(`${pageCount}`);
    }
  }, [pageCount, endPage]);

  async function handleTranslate() {
    const payload: any = {};
    if (rangeOn) {
      const s = Number(startPage);
      const e = Number(endPage);
      if (
        !Number.isInteger(s)
        || !Number.isInteger(e)
        || s < 1
        || e < s
        || (pageCount && e > pageCount)
      ) {
        setError(`Invalid page range(1–${pageCount || "total pages"})`);
        return;
      }
      payload.ocr = { page_ranges: `${s}-${e}` };
      payload.translation = { start_page: s, end_page: e };
    }
    // 先切到Translation Tab, 保证 bd-job-status-inner 在视口内再接Progress
    onTranslateStarted?.();
    await withBusy(
      "translate",
      async () => {
        // promoteDocumentToJob: 改详情 payload + silent attachJobProgress
        // 不 openTranslationWorkflow
        await actions.translateDocument(documentId, payload);
        onTranslateStarted?.();
      },
      "Start translationFailed",
    );
  }

  return {
    rangeOn,
    startPage,
    endPage,
    setRangeOn,
    setStartPage,
    setEndPage,
    handleTranslate,
  };
}



