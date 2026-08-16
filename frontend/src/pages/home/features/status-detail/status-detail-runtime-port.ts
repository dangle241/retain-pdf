import {
  createSecondaryResourceStatePort,
  createCurrentJobStatePort,
  createJobRenderContextPort,
} from "../../composition/external.js";
import type {
  JobLike,
  JobPayload,
  EventsPayload,
} from "../../composition/external.js";

// runtimePort của StatusDetailDialog (nguyên tắc nguồn dữ liệu trong thiết kế §1: đọc state được giữ lại của job-runtime,
// không đọc statusCardStore).
//
// Logic sao chép từ src/js/bootstrap/status-detail-runtime-port.js; đường dẫn file này khớp
// regex chống hồi quy `/bootstrap/` của architecture-boundaries.test.mjs, pages/** bị cấm
// import; nhưng bản thân nó chỉ là tổ hợp literal của ba port job-runtime được giữ lại
// (current-job-state.js/secondary-resource-cache.js/render-context.js),
// không có logic DOM nên sao chép trực tiếp không có rủi ro. composition.js dùng cùng một jobRuntimeState
// để khởi tạo, nhận đúng cùng instance currentJobStore/
// secondaryResourceStore với engine job-runtime, không tạo trạng thái song song mới.

/** Tham số applyOverviewPayload: nhóm payload ghi lại vào runtime sau khi làm mới tổng quan. */
export interface StatusDetailOverviewPayloadOptions {
  payload?: JobLike | JobPayload | Record<string, unknown> | null;
  eventsPayload?: EventsPayload | null;
  diagnosticsPayload?: unknown;
  resumePlan?: unknown;
  fallbackJobId?: string;
}

export function createStatusDetailRuntimePort(state: object) {
  const currentJobPort = createCurrentJobStatePort(state);
  const secondaryResourcePort = createSecondaryResourceStatePort(state);
  const renderContextPort = createJobRenderContextPort(state);

  return {
    currentJobId() {
      return currentJobPort.jobId();
    },
    currentJobSnapshot() {
      return currentJobPort.snapshot();
    },
    currentRenderContext(jobId: string) {
      return renderContextPort.currentFor(jobId);
    },
    currentJobFinishedAt() {
      return currentJobPort.finishedAt();
    },
    currentResumePlan() {
      return currentJobPort.resumePlan();
    },
    rerunContext() {
      return {
        job: currentJobPort.snapshot(),
        resumePlan: this.currentResumePlan(),
      };
    },
    cacheJobDiagnostics(jobId: string, payload: unknown) {
      currentJobPort.cacheDiagnostics(jobId, payload);
    },
    cacheJobResumePlan(jobId: string, payload: unknown) {
      currentJobPort.cacheResumePlan(jobId, payload);
    },
    cacheEvents(jobId: string, payload: unknown) {
      secondaryResourcePort.cache("events", jobId, payload);
    },
    isCurrentJob(jobId: string) {
      return this.currentJobId() === `${jobId || ""}`.trim();
    },
    applyOverviewPayload({
      payload,
      eventsPayload = null,
      diagnosticsPayload = null,
      resumePlan = null,
      fallbackJobId = "",
    }: StatusDetailOverviewPayloadOptions = {}) {
      const context = renderContextPort.applySnapshot({
        payload: {
          ...(payload || {}),
          job_id: payload?.job_id || fallbackJobId,
        },
        eventsPayload,
      });
      currentJobPort.cacheDiagnostics(context.jobId, diagnosticsPayload);
      currentJobPort.cacheResumePlan(context.jobId, resumePlan);
      if (context.job && diagnosticsPayload) {
        context.job = {
          ...context.job,
          diagnostics: diagnosticsPayload,
        };
        const currentSnapshot = currentJobPort.getSnapshot();
        currentJobPort.syncSnapshot(context.job, context.jobId, {
          startedAt: context.job.started_at || context.job.created_at || currentSnapshot.startedAt || "",
          finishedAt: context.job.finished_at || context.job.updated_at || currentSnapshot.finishedAt || "",
        });
      }
      return context;
    },
  };
}

export type StatusDetailRuntimePort = ReturnType<typeof createStatusDetailRuntimePort>;
