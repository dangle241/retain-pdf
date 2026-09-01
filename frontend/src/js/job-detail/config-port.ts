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
? "Currently a mock detail page, you can share the current link directly."
: "The current detail page can be shared with others directly via URL.";
  }

  return Object.freeze({
    buildDetailPageUrl,
    buildReaderPageUrl,
    detailShareNote,
    isMock,
  });
}

export const defaultJobDetailConfigPort = createJobDetailConfigPort();
