// Details "Translation" Tab PageRange + Ready. Provide source text. + Silent attachJobProgress.
// progress only in bd-job-status-inner, without opening the workflow popup.

import { useEffect, useState } from "react";

/**
 * @param {object} options
 * @param {boolean} options.open
 * @param {string} options.documentId
 * @param {number} options.pageCount
* @param {object} options.actions library.actions (includes attachJobProgress / translateDocument)
 * @param {(key: string, fn: Function, fail: string) => Promise<void>} options.withBusy
 * @param {(msg: string) => void} options.setError
* @param {() => void} [options.onTranslateStarted] Switch to translation after successful submission. Tab etc.
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
        setError(`Invalid page range (1–${pageCount || "Total pages"}）`);
        return;
      }
      payload.ocr = { page_ranges: `${s}-${e}` };
      payload.translation = { start_page: s, end_page: e };
    }
    // First switch to translation Tab, ensuring bd-job-status-inner Resume progress in viewport
    onTranslateStarted?.();
    await withBusy(
      "translate",
      async () => {
        // promoteDocumentToJobupdate details payload + silent attachJobProgress
// Do not openTranslationWorkflow
        await actions.translateDocument(documentId, payload);
        onTranslateStarted?.();
      },
      "Translation failed.",
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
