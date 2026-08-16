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
 * Chỉ thăm dò chi tiết "các tác vụ hoạt động khác" và vá từng thẻ.
 * Không còn định kỳ loadRecentJobs toàn bộ danh sách vì sẽ chồng với reload soft/silent và làm lưới nhấp nháy.
 * Đồng bộ đầy đủ dành cho: màn hình đầu, tìm kiếm, sau xóa/tạo, làm mới thủ công, scheduleRefresh.
 */
export function createActiveLibraryRefreshLoop({
  getItems,
  currentJobId = () => "",
  fetchJobPayload,
  apiPrefix,
  updateFromRuntime,
  // Giữ tham số để tương thích bên gọi cũ; luồng định kỳ không còn dùng.
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
