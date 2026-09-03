import { DOWNLOAD_ACTION_IDS } from "../../composition/external.js";

// Status card DOM contract id copy (Blueprint §2 features/status/).
//
// Copied from components/status/job-status-card-dom-contract.js (that file is "dead",
// on the "to be replaced by StatusCard.jsx family" list; js/components/ prohibits import;
// DOWNLOAD_ACTION_IDS comes from contracts/, not in the forbidden zone, imported as-is). id strings
// preserved one-by-one——smoke DOM contract (Blueprint §0) relies on these ids for assertions.

export const STATUS_CARD_IDS = Object.freeze({
  cancelButton: "cancel-btn",
  detailButton: "status-detail-btn",
  stageFlow: "status-stage-flow",
  ringLabel: "status-ring-label",
  ringValue: "status-ring-value",
  ringElapsed: "status-ring-elapsed",
  stageDetail: "status-stage-detail",
  stageErrorSummary: "status-stage-error-summary",
  progressBar: "status-progress-bar",
  legacyProgressBar: "job-progress-bar",
  progressText: "job-progress-text",
  progressPercent: "status-progress-percent",
  progressRing: "status-progress-ring",
  progressRingMeta: "status-progress-ring-meta",
  stageRetry: "status-stage-retry",
  markdownBundleButton: DOWNLOAD_ACTION_IDS.STATUS_MARKDOWN_BUNDLE,
  readerButton: "reader-btn",
  pdfButton: DOWNLOAD_ACTION_IDS.PDF,
  sourcePdfButton: DOWNLOAD_ACTION_IDS.SOURCE_PDF,
  legacyBundleButton: DOWNLOAD_ACTION_IDS.BUNDLE,
  legacyMarkdownRawButton: DOWNLOAD_ACTION_IDS.MARKDOWN_RAW,
  legacyMarkdownJsonButton: DOWNLOAD_ACTION_IDS.MARKDOWN_JSON,
});

export const STATUS_CARD_ACTION_IDS = Object.freeze({
  pdf: STATUS_CARD_IDS.pdfButton,
  reader: STATUS_CARD_IDS.readerButton,
  sourcePdf: STATUS_CARD_IDS.sourcePdfButton,
  markdownBundle: STATUS_CARD_IDS.markdownBundleButton,
});

