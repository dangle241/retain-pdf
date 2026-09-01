import { isRecentJobActive } from "./card-presenter.js";
import {
  defaultRecentJobsRefreshEnvironment,
} from "./refresh-environment.js";

export const LIBRARY_ACTIVE_REFRESH_MS = 2500;

export function hasActiveRecentJobs(items = []) {
  return (Array.isArray(items) ? items : []).some(isRecentJobActive);
}

export function recentJobsEligibleForActiveRefresh(items = [], currentJobId = "") {
  const activeJobId = `${currentJobId || ""}`.trim();
  return (Array.isArray(items) ? items : [])
    .filter(isRecentJobActive)
    .filter((item) => {
      const jobId = `${item?.job_id || ""}`.trim();
      return jobId && jobId !== activeJobId;
    });
}

/**
 * 仅轮询「其它活跃任务」详情并单卡 patch。
 * 不再周期 loadRecentJobs 全量列表——那会与 soft/silent reload 叠成网格闪烁。
 * 全量对齐留给：首屏、搜索、删除/创建后、手动刷新、scheduleRefresh。
 */
export function createActiveLibraryRefreshLoop({
  getItems,
  currentJobId = () => "",
  fetchJobPayload,
  apiPrefix,
  updateFromRuntime,
  // 保留参数兼容旧调用方，周期路径不再使用
  loadRecentJobs: _loadRecentJobs,
  isRecentJobsLoading,
  environment = defaultRecentJobsRefreshEnvironment,
}: any) {
  let activeLibraryRefreshTimer = null;

  function stop() {
    environment.clearTimeout(activeLibraryRefreshTimer);
    activeLibraryRefreshTimer = null;
  }

  async function refreshActiveRecentJobDetails() {
    if (!fetchJobPayload) {
      return;
    }
    const activeItems = recentJobsEligibleForActiveRefresh(getItems(), currentJobId()).slice(0, 6);
    await Promise.allSettled(activeItems.map(async (item) => {
      const jobId = `${item?.job_id || ""}`.trim();
      if (!jobId) {
        return;
      }
      const payload = await fetchJobPayload(jobId, apiPrefix);
      updateFromRuntime(payload);
    }));
  }

  function schedule({ resetTimer = true }: any = {}) {
    if (resetTimer) {
      stop();
    }
    if (activeLibraryRefreshTimer) {
      return;
    }
    if (!recentJobsEligibleForActiveRefresh(getItems(), currentJobId()).length) {
      return;
    }
    activeLibraryRefreshTimer = environment.setTimeout(() => {
      activeLibraryRefreshTimer = null;
      if (isRecentJobsLoading()) {
        schedule();
        return;
      }
      void refreshActiveRecentJobDetails().finally(() => {
        schedule();
      });
    }, LIBRARY_ACTIVE_REFRESH_MS);
  }

  return {
    schedule,
    stop,
  };
}
