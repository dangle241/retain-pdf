export function createRecentJobsRuntimePort({
  openJob,
  /** Cold start / resume active job: silent by default, does not raise workflow area */
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


