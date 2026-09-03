// Reading entry: converts openReaderRequested / deep links into navigation.
//
// Default soft open (navigate-to-reader → SoftReaderHost full-screen layer), main page
// does not unmount; deep link replace still hard-navigates to reader.html.

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
 * Null UI: only responsible for converting "open reader" events / deep links into
 * reader.html navigation. Component name kept as ReaderDialog to avoid large-scale
 * import changes in HomeApp / tests.
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

  // Main page deep link ?view=reader&job_id= → directly enter reading page (replace,
  // avoid back-button loop)
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




