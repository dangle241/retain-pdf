// Reader entry: convert openReaderRequested / deep link Convert to navigation.
//
// Default to soft open（navigate-to-reader → SoftReaderHost Fullscreen layer; homepage persists.
// Deep link replace Force insert. reader.html.

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
* No UI, only responsible for "Open for reading" event / deep link convert to redirect reader.html.
* Component name retained ReaderDialog, to avoid HomeApp / test import Extensive changes.
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

  // Homepage deep link ?view=reader&job_id= → Navigate directly to reading page (replaceavoid back-button infinite loop)
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
