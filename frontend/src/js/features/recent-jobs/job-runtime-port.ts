export function createRecentJobsRuntimePort({
  openJob,
  /** Khôi phục tác vụ đang hoạt động khi khởi động lạnh: mặc định silent, không mở vùng workflow. */
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
