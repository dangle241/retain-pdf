import {
  cachedEventsFor,
  cachedManifestFor,
  cachedStageActionsFor,
} from "./secondary-resource-cache.js";

// Globally symbol read current-job store (direct import of current-job-state.js causes circular dependency);
// No store: read pure snapshot object fields directly by name
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
