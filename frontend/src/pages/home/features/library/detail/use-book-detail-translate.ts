// Detail "Translation" Tab: page range scope + Start translation + silent attachJobProgress.
// Progress only in bd-job-status-inner, does not open workflow dialog.

import { useEffect, useState } from "react";

/**
 * @param {object} options
 * @param {boolean} options.open
 * @param {string} options.documentId
 * @param {number} options.pageCount
 * @param {object} options.actions library.actions (includes attachJobProgress / translateDocument)
 * @param {(key: string, fn: Function, fail: string) => Promise<void>} options.withBusy
 * @param {(msg: string) => void} options.setError
 * @param {() => void} [options.onTranslateStarted] Switch to Translation Tab after successful submission, etc.
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
    // Switch to Translation Tab first, ensure bd-job-status-inner is in viewport before receiving Progress
    onTranslateStarted?.();
    await withBusy(
      "translate",
      async () => {
        // promoteDocumentToJob: update detail payload + silent attachJobProgress
        // do not openTranslationWorkflow
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



