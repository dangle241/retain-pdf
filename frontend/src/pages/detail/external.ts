// pages/detail 对 src/js/* 的唯一出口。
// DetailApp / components 禁止直接 import ../../js/**；缺符号只改本文件。

// —— job ——
export { normalizeJobPayload } from "../../js/job/normalize.js";
export { isJobTerminal } from "../../js/job/core.js";
export {
  formatEventTimestamp,
  formatRuntimeDuration,
} from "../../js/job/formatters.js";
export { stageHistoryDisplay } from "../../js/job/stage-history.js";

// —— job-detail ——
export { getJobIdFromQuery } from "../../js/job-detail/routing.js";
export { defaultJobDetailConfigPort } from "../../js/job-detail/config-port.js";
export { defaultJobDetailDataPort } from "../../js/job-detail/data-port.js";
export { defaultJobDetailResumePort } from "../../js/job-detail/resume-port.js";
export { bindRerunButton } from "../../js/job-detail/resume.js";
export { renderJobDetailOverview } from "../../js/job-detail/overview-renderer.js";
export { loadAndRenderMarkdownFlow } from "../../js/job-detail/markdown-flow.js";
export {
  createJobDetailPageState,
  revokeJobDetailMarkdownImageUrls,
} from "../../js/job-detail/page-state.js";
export { buildJobDetailEventViewModel } from "../../js/job-detail/status-view-model.js";

// —— downloads ——
export {
  fileNameFromDisposition,
  prepareDownloadTarget,
  saveResponseDownload,
} from "../../js/utils/downloads.js";
export {
  completeDownloadToast,
  failDownloadToast,
  showDownloadPreparing,
  updateDownloadProgress,
} from "../../js/utils/download-feedback.js";
