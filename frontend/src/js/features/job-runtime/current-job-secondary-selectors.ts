import {
  cachedEventsFor,
  cachedManifestFor,
  cachedStageActionsFor,
} from "./secondary-resource-cache.js";

// Read current-job store via global Symbol (direct import of current-job-state.js causes circular dependency);
// plain snapshot objects without a store read fields by name directly
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

