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

// StatusDetailDialog 的 runtimePort(蓝图 §1 Data源铁律:读 job-runtime 保留
// 引擎的 state,不yes statusCardStore).
//
// 逻辑拷贝自 src/js/bootstrap/status-detail-runtime-port.js——该Files路径命中
// architecture-boundaries.test.mjs 的 `/bootstrap/` 防回弹正则,pages/** 禁止
// import;但它books身只yes job-runtime 三个 kept 端口
// (current-job-state.js/secondary-resource-cache.js/render-context.js)的字面量
// 组合,零 DOM 逻辑,直接照抄零风险.composition.js 用同一个 jobRuntimeState
// 对象构造,拿到与 job-runtime 引擎完全同一份 currentJobStore/
// secondaryResourceStore 引用,不新建平行Status.

/** applyOverviewPayload 入参: Overview刷新后写回 runtime 的一batches载荷 */
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



