import {
  buildFrontendPageUrl,
  isMockMode,
} from "../config/runtime.js";

export function createJobDetailConfigPort({
  buildPageUrl = buildFrontendPageUrl,
  isMock = isMockMode,
} = {}) {
  function buildReaderPageUrl(jobId) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId) {
      return "";
    }
    return buildPageUrl("./reader.html", {
      job_id: normalizedJobId,
    });
  }

  function buildDetailPageUrl(jobId) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId) {
      return "";
    }
    return buildPageUrl("./detail.html", {
      job_id: normalizedJobId,
    });
  }

  function detailShareNote() {
    return isMock()
      ? "Đây là trang chi tiết mô phỏng; có thể chia sẻ trực tiếp liên kết hiện tại."
      : "Có thể chia sẻ trực tiếp trang chi tiết hiện tại với người khác bằng URL.";
  }

  return Object.freeze({
    buildDetailPageUrl,
    buildReaderPageUrl,
    detailShareNote,
    isMock,
  });
}

export const defaultJobDetailConfigPort = createJobDetailConfigPort();
