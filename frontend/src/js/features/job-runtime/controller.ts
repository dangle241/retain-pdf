import {
  clearActiveJobId,
  writeActiveJobId,
} from "./active-job-storage.js";
import {
  createJobEventsResource,
} from "./job-events-resource.js";
import { createCurrentJobStatePort } from "./current-job-state.js";
import { createSecondaryResourceStatePort } from "./secondary-resource-cache.js";
import {
  createJobRenderContextPort,
} from "./render-context.js";
import {
  createRuntimePollingStatePort,
  JOB_POLL_INTERVAL_MS,
} from "./runtime-polling-state.js";
import {
  notifyLibraryJobUpdated,
  requestLibraryRefresh,
} from "./library-events.js";
import { createSecondaryResourceSchedulerPort } from "./secondary-resources.js";
import { returnJobRuntimeToHome } from "./runtime-reset.js";
import { createJobRuntimeShellViewPort } from "./shell-view-port.js";
import { createJobRuntimeResetStatePort } from "./reset-state-port.js";

export function mountJobRuntimeFeature({
  state,
  apiPrefix,
  buildJobDetailEndpoint,
  fetchJobPayload,
  fetchJobEvents,
  fetchJobArtifactsManifest,
  fetchJobStageActions,
  retryJobStage,
  submitJson,
  renderJob,
  renderJobSecondaryPatch,
  setText,
  setWorkflowSections,
  resetUploadProgress,
  resetUploadedFile,
  applyWorkflowMode,
  clearPageRanges,
  updateJobWarning,
  activateDetailTab,
  onReaderDialogSync,
  onReaderDialogClose,
  uploadStatePort,
  libraryEventPort,
  jobEventsResource = createJobEventsResource({ fetchJobEvents, apiPrefix }),
  pollingPort = createRuntimePollingStatePort(state),
  currentJobPort = createCurrentJobStatePort(state),
  secondaryResourcePort = createSecondaryResourceStatePort(state),
  shellViewPort = createJobRuntimeShellViewPort(),
  jobPresentationPort,
  resetStatePort = createJobRuntimeResetStatePort(state),
  renderContextPort = createJobRenderContextPort(state, { jobPresentationPort }),
  secondaryResourceSchedulerPort = createSecondaryResourceSchedulerPort({
    state,
    apiPrefix,
    fetchJobEvents,
    jobEventsResource,
    fetchJobArtifactsManifest,
    fetchJobStageActions,
    renderJobSecondaryPatch,
    notifyLibraryJobUpdated: (job) => notifyLibraryJobUpdated(job, { port: libraryEventPort }),
    pollingPort,
    currentJobPort,
    secondaryResourcePort,
    renderContextPort,
    jobPresentationPort,
  }),
}: any) {
  const normalizeJobPayload = jobPresentationPort?.normalizeJobPayload || ((value) => value || {});
  const isTerminalStatus = jobPresentationPort?.isTerminalStatus || ((status) => status === "failed" || status === "canceled");
  const isJobTerminal = jobPresentationPort?.isJobTerminal || ((value: any = {}) => isTerminalStatus(value?.status || value));
  // Whether current polling session broadcasts progress patches to Library.
  // silent: skips full library refresh, but status/stage changes still sync (cover spinner / finished "Translated").
  let sessionPublishLibrary = true;
  /** In silent mode, previous status|stage pushed to shelf, used to skip duplicate notifies */
  let lastLibraryPublishKey = "";

  function libraryPublishKeyOf(job: any = {}) {
    const status = `${job?.status || ""}`.trim();
    const stage = `${job?.display_stage || job?.stage || ""}`.trim();
    return `${job?.job_id || ""}|${status}|${stage}`;
  }

  async function fetchJob(jobId) {
    const generation = pollingPort.beginPoll();
    if (generation === null) {
      return;
    }
    let payload;
    try {
      payload = await fetchJobPayload(jobId, apiPrefix);
    } finally {
      pollingPort.finishPoll();
    }
    if (!pollingPort.isCurrentGeneration(jobId, generation)) {
      return;
    }
    const cachedEvents = secondaryResourcePort.cachedFor("events", jobId);
    const cachedManifest = secondaryResourcePort.cachedFor("manifest", jobId);
    const cachedStageActions = secondaryResourcePort.cachedFor("stageActions", jobId);
    const renderContext = renderContextPort.applySnapshot({
      payload,
      eventsPayload: cachedEvents,
      manifestPayload: cachedManifest,
      stageActionsPayload: cachedStageActions,
    });
    // Progress home: statusCardStore (main card / detail embedded card both use it)
    renderJob(renderContext);
    const job = normalizeJobPayload(payload);
    const terminal = isJobTerminal(job);
    const publishKey = libraryPublishKeyOf(job);
    // Full publish every poll; silent: only on status/stage change or terminal (cover spinner needs status=running)
    if (sessionPublishLibrary || terminal || publishKey !== lastLibraryPublishKey) {
      lastLibraryPublishKey = publishKey;
      notifyLibraryJobUpdated(job, { port: libraryEventPort });
    }
    if (shellViewPort.isReaderOpen()) {
      onReaderDialogSync?.();
    }
    if (terminal) {
      requestLibraryRefresh(state, { terminal: true, port: libraryEventPort });
      clearActiveJobId(jobId);
      pollingPort.stop();
    }
    secondaryResourceSchedulerPort.schedule({
      jobId,
      payload,
      generation,
      terminal,
    });
  }

  /**
   * @param {string} jobId
   * @param {{
   *   silent?: boolean,
   *   publishLibrary?: boolean,
   *   showWorkflow?: boolean,
   * }} [options]
   * - silent: embedded progress in detail tabs, etc.; does not raise workflow area or broadcast create
   * - publishLibrary / showWorkflow: default to !silent
   */
  function startPolling(
    jobId: string,
    options: {
      silent?: boolean;
      publishLibrary?: boolean;
      showWorkflow?: boolean;
      /** First frame payload (retry carries fromStage result to avoid flashing "queued") */
      seedPayload?: Record<string, unknown> | null;
    } = {},
  ) {
    const silent = Boolean(options.silent);
    const publishLibrary = options.publishLibrary ?? !silent;
    const showWorkflow = options.showWorkflow ?? !silent;
    sessionPublishLibrary = publishLibrary;
    lastLibraryPublishKey = "";

    pollingPort.stop();
    writeActiveJobId(jobId);
    resetStatePort.resetSecondary();
    const { startedAt } = pollingPort.startJob(jobId);
    const seed = options.seedPayload && typeof options.seedPayload === "object"
      ? options.seedPayload
      : null;
    const placeholderJob = seed
      ? {
          ...seed,
          job_id: jobId,
          // Retry first frame forces running to avoid staying on "Translated" without spinning
          status: seed.status && seed.status !== "succeeded"
            ? seed.status
            : "running",
          library_only: false,
          created_at: seed.created_at || startedAt,
          started_at: seed.started_at || startedAt,
        }
      : {
          job_id: jobId,
          status: "queued",
          stage: "queued",
          display_stage: "ocr",
          lane: "main",
          current_stage: "queued",
          stage_detail: "Loading job status...",
          created_at: startedAt,
          started_at: startedAt,
        };
    if (showWorkflow) {
      setWorkflowSections(placeholderJob);
    }
    // Always write statusCardStore for shared snapshots between main card and embedded detail card
    renderJob(renderContextPort.applySnapshot({
      payload: placeholderJob,
    }));
    // Library: full mode unchanged; silent must still push a running frame so cover can spin
    const normalizedPlaceholder = normalizeJobPayload(placeholderJob);
    if (publishLibrary) {
      libraryEventPort?.publishJobCreated?.(normalizedPlaceholder);
      requestLibraryRefresh(state, { port: libraryEventPort });
    }
    lastLibraryPublishKey = libraryPublishKeyOf(normalizedPlaceholder);
    notifyLibraryJobUpdated(normalizedPlaceholder, { port: libraryEventPort });
    fetchJob(jobId).catch((err) => {
      setText("error-box", err.message);
    });
    pollingPort.startTimer(() => {
      fetchJob(jobId).catch((err) => {
        setText("error-box", err.message);
      });
    }, JOB_POLL_INTERVAL_MS);
  }

  function returnToHome() {
    returnJobRuntimeToHome({
      state,
      onReaderDialogClose,
      setWorkflowSections,
      resetUploadProgress,
      resetUploadedFile,
      applyWorkflowMode,
      clearPageRanges,
      setText,
      updateJobWarning,
      activateDetailTab,
      uploadStatePort,
      shellViewPort,
      jobPresentationPort,
    });
  }

  async function cancelCurrentJob() {
    const jobId = currentJobPort.jobId();
    if (!jobId) {
      setText("error-box", "There is no current job to cancel");
      return;
    }
    shellViewPort.setCancelDisabled(true);
    try {
      await submitJson(`${buildJobDetailEndpoint(jobId, apiPrefix)}/cancel`, {});
      await fetchJob(jobId);
    } catch (err) {
      setText("error-box", err.message);
    }
  }

  async function retryStage(stage, options: { jobId?: string } = {}) {
    const normalizedStage = `${stage || ""}`.trim();
    // Event jobId takes priority -> current poll -> previous snapshot (retry click on detail card might not have currentJobId yet)
    const jobId = `${
      options.jobId
      || currentJobPort.jobId()
      || currentJobPort.snapshot?.()?.job_id
      || ""
    }`.trim();
    if (!jobId || !normalizedStage) {
      setText("error-box", "There is no current stage to run again");
      return;
    }
    try {
      setText("error-box", "-");
      // statusCard snapshot top level has no document_id; identity lives in job / raw_response
      const prevSnapshot = (currentJobPort.snapshot?.() || {}) as Record<string, unknown>;
      const prevJob = (
        (prevSnapshot.job && typeof prevSnapshot.job === "object" ? prevSnapshot.job : null)
        || prevSnapshot
      ) as Record<string, unknown>;
      const prevRaw = (
        (prevJob.raw_response && typeof prevJob.raw_response === "object" ? prevJob.raw_response : null)
        || prevJob
      ) as Record<string, unknown>;
      const pickBook = (...keys: string[]) => {
        for (const key of keys) {
          for (const source of [prevSnapshot, prevJob, prevRaw]) {
            const value = `${source?.[key] ?? ""}`.trim();
            if (value) return value;
          }
        }
        return "";
      };
      const bookMeta = {
        document_id: pickBook("document_id"),
        title: pickBook("title", "display_name"),
        display_name: pickBook("display_name", "title"),
        page_count: prevSnapshot.page_count ?? prevJob.page_count ?? prevRaw.page_count,
        cover_url: pickBook("cover_url"),
        thumbnail_url: pickBook("thumbnail_url"),
      };
      const result = await retryJobStage(jobId, apiPrefix, normalizedStage, bookMeta);
      const nextJobId = `${result?.job_id || jobId}`.trim();
      if (nextJobId) {
        // Progress fields use result; bibliographic metadata prioritizes bookMeta (avoids Mock Retry title overwriting real title)
        const seed = normalizeJobPayload({
          ...result,
          job_id: nextJobId,
          source_job_id: jobId,
          document_id: result?.document_id || bookMeta.document_id,
          title: bookMeta.title || result?.title,
          display_name: bookMeta.display_name || bookMeta.title || result?.display_name,
          cover_url: bookMeta.cover_url || result?.cover_url,
          thumbnail_url: bookMeta.thumbnail_url || result?.thumbnail_url,
          page_count: bookMeta.page_count ?? result?.page_count,
          library_only: false,
          active_job_id: nextJobId,
        });
        // Retry inside detail tab: silent + first frame uses fromStage result; must include document_id/source_job_id
        startPolling(nextJobId, {
          silent: true,
          showWorkflow: false,
          publishLibrary: false,
          seedPayload: {
            ...seed,
            source_job_id: jobId,
            document_id: seed.document_id || bookMeta.document_id,
            title: seed.title || bookMeta.title,
            display_name: seed.display_name || bookMeta.display_name || bookMeta.title,
            cover_url: seed.cover_url || bookMeta.cover_url,
            thumbnail_url: seed.thumbnail_url || bookMeta.thumbnail_url,
            status: seed.status && seed.status !== "succeeded" ? seed.status : "running",
          },
        });
        // startPolling already notified a running frame, no duplicate needed here
      } else {
        await fetchJob(jobId);
      }
    } catch (err) {
      setText("error-box", err.message || String(err));
    }
  }

  return {
    cancelCurrentJob,
    currentJobId: () => currentJobPort.jobId(),
    fetchJob,
    retryStage,
    returnToHome,
    startPolling,
    stopPolling: () => pollingPort.stop(),
  };
}





