import {
  cachedEventsFor,
  cachedManifestFor,
  cachedStageActionsFor,
} from "./secondary-resource-cache.js";

// Đọc current-job store qua Symbol toàn cục (import trực tiếp current-job-state.js sẽ tạo phụ thuộc vòng);
// đối tượng snapshot thuần không có store được đọc trực tiếp theo tên trường.
const CURRENT_JOB_STORE_KEY = Symbol.for("retainpdf.currentJobStore");

function currentJobId(state) {
  const snapshot = state?.[CURRENT_JOB_STORE_KEY]?.getSnapshot?.();
  if (snapshot) {
    return `${snapshot.jobId || ""}`.trim();
  }
  return `${state?.currentJobId || ""}`.trim();
}

export function currentJobManifest(state) {
  return cachedManifestFor(state, currentJobId(state));
}

export function currentJobStageActions(state) {
  return cachedStageActionsFor(state, currentJobId(state));
}

export function currentJobEventsFor(state, jobId) {
  return cachedEventsFor(state, jobId);
}
