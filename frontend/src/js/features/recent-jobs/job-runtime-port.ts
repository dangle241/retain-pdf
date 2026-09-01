export function createRecentJobsRuntimePort({
  openJob,
  /** Restore active tasks on cold start: default silentwithout lifting workflow area */
  recoverJob,
  currentJobId = () => "",
}: any = {}) {
  function normalizeAndRun(handler, jobId) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId) {
      return false;
    }
    handler?.(normalizedJobId);
    return true;
  }

  return {
    currentJobId() {
      return `${currentJobId?.() || ""}`.trim();
    },

    openJob(jobId) {
      return normalizeAndRun(openJob, jobId);
    },

    recoverJob(jobId) {
      const handler = recoverJob || openJob;
      return normalizeAndRun(handler, jobId);
    },
  };
}
