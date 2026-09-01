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
      // Apply single-card patch only while running; no invalidate / full-page refresh. invalidate / Not full page refresh。
      // per beat invalidate Will allow any subsequent soft reload Network saturated, full-full frame re-render.
      runtimePatches.update(job);
      const status = `${(job as LibraryJobItem | null | undefined)?.status || ""}`.trim();
      if (isTerminalStatus(status)) {
        invalidateLibraryBooksResource(libraryBooksResource);
// soft silent: align doc projection/cover once on terminal state/cover.
        refreshScheduler.scheduleRefresh({ delay: 400, bypassThrottle: true });
      }
    },
    onJobCreated: ({ job }: RecentJobsJobCommandPayload = {}) => {
      invalidateLibraryBooksResource(libraryBooksResource);
      // insert Internally sorted by document_id upsertExisting books updated in place; no second copy prepended. prepend Second sheet
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
