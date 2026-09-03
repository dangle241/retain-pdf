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

// StatusDetailDialog runtime port (blueprint §1 data source iron law: reads
// job-runtime state, NOT statusCardStore).
//
// Literal copy from src/js/bootstrap/status-detail-runtime-port.js — that file
// is in a directory that architecture-boundaries.test.mjs's `/bootstrap/`
// anti-bounce regex blocks pages/** from importing; but this file itself only
// aggregates three kept job-runtime ports
// (current-job-state.js/secondary-resource-cache.js/render-context.js) with zero
// DOM logic, so a direct copy carries zero risk. composition.js uses the same
// jobRuntimeState object, obtaining identical currentJobStore/secondaryResourceStore
// references as the job-runtime engine — no new parallel state is created.

/** applyOverviewPayload input: batch of payloads written back to runtime after Overview refresh */
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


