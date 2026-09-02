import { invalidateLibraryBooksResource } from "./library-books-resource.js";
import { hydrateCreatedRecentJob } from "./created-job-hydration.js";
import { isTerminalStatus } from "../../job/core.js";
import type {
  RecentJobsCommandPort,
  RecentJobsCommandSubscription,
  RecentJobsJobCommandPayload,
  RecentJobsRefreshRequest,
} from "./commands.js";
import type { LibraryJobItem } from "./runtime-item.js";
import type { RecentJobsRuntimePatches } from "./runtime-patches.js";

export interface BindRecentJobsCommandHandlersOptions {
  apiPrefix?: string;
  commandPort?: Pick<RecentJobsCommandPort, "subscribe">;
  fetchJobPayload?: (
    jobId: string,
    apiPrefix?: string,
  ) => Promise<LibraryJobItem | Record<string, unknown> | null | undefined>;
  libraryBooksResource?: { invalidate?: () => void } | null;
  runtimePatches?: Pick<RecentJobsRuntimePatches, "update" | "insert">;
  refreshScheduler?: {
    scheduleRefresh: (options?: RecentJobsRefreshRequest) => void;
  };
}

export function bindRecentJobsCommandHandlers({
  apiPrefix,
  commandPort,
  fetchJobPayload,
  libraryBooksResource,
  runtimePatches,
  refreshScheduler,
}: BindRecentJobsCommandHandlersOptions = {}): RecentJobsCommandSubscription {
  return commandPort.subscribe({
    onRefreshRequested: ({ delay, force }: RecentJobsRefreshRequest = {}) => {
      invalidateLibraryBooksResource(libraryBooksResource);
      refreshScheduler.scheduleRefresh({ delay: Number(delay ?? 600), force });
    },
    onJobUpdated: ({ job }: RecentJobsJobCommandPayload = {}) => {
      // While running, only patch individual cards; do not invalidate or refresh full page.
      // Every invalidate causes any subsequent soft reload to hit the network and rerender the full grid.
      runtimePatches.update(job);
      const status = `${(job as LibraryJobItem | null | undefined)?.status || ""}`.trim();
      if (isTerminalStatus(status)) {
        invalidateLibraryBooksResource(libraryBooksResource);
        // soft silent: align document projection / cover once at terminal state
        refreshScheduler.scheduleRefresh({ delay: 400, bypassThrottle: true });
      }
    },
    onJobCreated: ({ job }: RecentJobsJobCommandPayload = {}) => {
      invalidateLibraryBooksResource(libraryBooksResource);
      // insert internally upserts by document_id: updates existing book in-place, never prepends a duplicate
      runtimePatches.insert(job);
      void hydrateCreatedRecentJob({
        job,
        apiPrefix,
        fetchJobPayload,
        runtimePatches,
      });
    },
  });
}


