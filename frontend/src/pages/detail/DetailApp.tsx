// Job Details page React orchestration root (rewrite of the old src/js/job-detail/index.js + view.js +
// modal-bindings.js + downloads.js + events.js starter).
//
// State strategy (current semantics, no store introduced):
// - Old-world pure logic (overview-renderer / markdown-flow / summary / action-links /
//   resume, etc.) writes copy via setText/setActionLink/setEventsStatus callbacks——here those
//   callbacks become React state (texts/links maps) and JSX reads by id;
// - Artifact Manifest, failure debug context, and Markdown image Grid still come from retained old modules
//   (artifacts.js / failure.js, via overview-renderer / markdown-flow) which after mount
//   write innerHTML into the leaf containers React rendered (see each component's comments);
// - Modal open/close, events-stream loading, and protected downloads are React-managed (the old view.js /
//   modal-bindings.js / events.js starter / downloads.js responsibilities).

import { useCallback, useEffect, useRef, useState } from "react";
import { DetailHeader } from "./components/DetailHeader.jsx";
import { ErrorNoticeCard, JobSummaryCard, MetaRow } from "./components/JobSummaryCard.jsx";
import { ErrorDiagnostics } from "./components/ErrorDiagnostics.jsx";
import { ArtifactsSection, MarkdownCard } from "./components/ArtifactsSection.jsx";
import {
  EventsModal,
  EventsTriggerCard,
  StageHistoryModal,
  StageHistoryTriggerCard,
} from "./components/EventsTimeline.jsx";
import { DownloadToastHost } from "../../shared/react/DownloadToastHost.jsx";
import {
  normalizeJobPayload,
  getJobIdFromQuery,
  defaultJobDetailConfigPort,
  defaultJobDetailDataPort,
  defaultJobDetailResumePort,
  bindRerunButton,
  renderJobDetailOverview,
  loadAndRenderMarkdownFlow,
  createJobDetailPageState,
  revokeJobDetailMarkdownImageUrls,
  fileNameFromDisposition,
  prepareDownloadTarget,
  saveResponseDownload,
  completeDownloadToast,
  failDownloadToast,
  showDownloadPreparing,
  updateDownloadProgress,
} from "./external.js";

const JOB_EVENTS_PAGE_SIZE = 200;

function eventsStatusText(payload) {
  const count = Array.isArray(payload?.items) ? payload.items.length : 0;
  return count > 0 ? `All events · ${count} entries` : "All events";
}

export function DetailApp({
  configPort = defaultJobDetailConfigPort,
  dataPort = defaultJobDetailDataPort,
  getJobId = getJobIdFromQuery,
  resumePort = defaultJobDetailResumePort,
} = {}) {
  const pageStateRef = useRef(null);
  if (!pageStateRef.current) {
    pageStateRef.current = createJobDetailPageState();
  }
  const [texts, setTexts] = useState({});
  const [links, setLinks] = useState({});
  const [job, setJob] = useState(null);
  const [stageHistoryOpen, setStageHistoryOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [eventsPayload, setEventsPayload] = useState(null);
  const [eventsStatus, setEventsStatus] = useState("Not loaded yet");
  const [openEventsText, setOpenEventsText] = useState("Load on demand");

  // Old view.js setDetailText semantics: value ?? "-"
  const setText = useCallback((id, value) => {
    setTexts((prev) => ({ ...prev, [id]: value ?? "-" }));
  }, []);

  // Old view.js setDetailActionLink semantics: href/disabled/aria-disabled trio
  const setActionLink = useCallback((id, url, enabled) => {
    setLinks((prev) => ({ ...prev, [id]: { url, enabled: Boolean(enabled) } }));
  }, []);

  const t = useCallback(
    (id, fallback = "-") => (Object.hasOwn(texts, id) ? texts[id] : fallback),
    [texts],
  );

  // Page-load orchestration: rebuild of old index.js initializePage hooks
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    const state = pageStateRef.current;
    window.addEventListener("beforeunload", () => {
      revokeJobDetailMarkdownImageUrls(state);
    }, { once: true });
    bindRerunButton({
      detailPageState: state,
      getJobId,
      resumePort,
      setText,
    });
    (async () => {
      const jobId = getJobId();
      if (!jobId) {
        setText("detail-head-note", "Missing job_id. Open this page with detail.html?job_id=...");
        return;
      }
      setText("detail-job-id", jobId);
      setText("detail-head-note", configPort.detailShareNote());

      const {
        diagnosticsPayload,
        manifestPayload,
        payloadRaw,
        resumePlan,
      } = await dataPort.loadOverview(jobId);
      const nextJob = normalizeJobPayload(payloadRaw);
      renderJobDetailOverview({
        diagnosticsPayload,
        job: nextJob,
        manifestPayload,
        resumePlan,
        setActionLink,
        setEventsStatus,
        setText,
        state,
      });
      setJob(nextJob);

      await loadAndRenderMarkdownFlow({
        fetchProtected: dataPort.fetchProtected,
        job: nextJob,
        jobId,
        loadMarkdownPayload: dataPort.loadMarkdownPayload,
        markdownImageUrls: state.markdownImageUrls,
        setActionLink,
        setText,
        state,
      });
    })().catch((error) => {
      // Old createPageRuntime onError semantics: write init errors into the header note
      setText("detail-head-note", error.message || String(error));
    });
    // Run once on mount; ports stay stable for the page lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Old modal-bindings.js: Escape closes all modals.
  //
  // Stage C wrap-up (shadcn migration) decision: after both modals became Radix Dialog,
  // keep this "unconditionally close both" handwritten listener instead of "only close
  // the currently open one". Reason: each modal is its own fixed inset-0 Radix Root/Content
  // and, when open, preemptively takes focus (focus trap) via DismissableLayer——when
  // StageHistoryModal is open its trigger card (EventsTriggerCard) is fully covered by
  // the overlay and cannot be focused/clicked, and vice versa, so the two modals are
  // always mutually exclusive on this page (at most one open=true at a time). That means
  // "close both" and "close only the current one" are equivalent in every reachable
  // state——setStageHistoryOpen / setEventsOpen on a side that is already false is an
  // idempotent no-op, with no double-fire semantic-collapse risk (unlike
  // TranslationWorkflowDialog's two-step close, which a "call once extra" would actually
  // break). Keeping the original is the lowest-risk choice in this batch; do not add a
  // new branch to tighten behavior that is unobservable under the current UI.
  //
  // This listener and Radix's own Escape handling (DismissableLayer, capture stage) both
  // run on the same keypress: Radix first calls onOpenChange(false) for "the currently
  // open one" (the matching setXxxOpen(false) takes effect), then this bubble-stage
  // listener calls setXxxOpen(false) on both——the already-false side is a no-op, with no
  // extra render or side effect, so the two mechanisms do not conflict.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") {
        return;
      }
      setStageHistoryOpen(false);
      setEventsOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Old view.js setDetailModalOpen handwritten body-scroll lock deleted: Radix Dialog
  // modal mode (default) already ships an equivalent body-scroll lock (react-remove-scroll,
  // attached to DialogPrimitive.Content, auto lock/unlock with Content's real
  // mount/unmount lifecycle; see DetailModal in EventsTimeline.jsx). Keeping this
  // handwritten document.body.style.overflow assignment would create two independent
  // writers racing the same CSS property——react-remove-scroll remembers the overflow
  // value from before lock and restores it exactly on unlock; assigning/clearing it
  // here can, on unlock-timing edge cases, reset the property to a value that disagrees
  // with Radix's memory (body still cannot scroll after closing a modal, or the reverse).
  // The two modals are mutually exclusive (as above); Radix's on-demand lock granularity
  // (whether the matching Content is mounted) already covers the old implementation's
  // intended semantics, so no handwritten lock is needed.

  // Old events.js fetchAllJobEvents + ensureEventsLoaded (paginate the full set + in-page cache)
  const ensureEventsLoaded = useCallback(async () => {
    const state = pageStateRef.current;
    if (state.eventsPayload) {
      return state.eventsPayload;
    }
    if (!state.job?.job_id) {
      throw new Error("Missing job_id. Cannot load the event stream.");
    }
    if (!state.eventsLoadingPromise) {
      setEventsStatus("Loading all events...");
      state.eventsLoadingPromise = (async () => {
        const items = [];
        let offset = 0;
        while (true) {
          const payload = await dataPort.fetchJobEvents(
            state.job.job_id,
            dataPort.apiPrefix,
            JOB_EVENTS_PAGE_SIZE,
            offset,
          );
          const page = (payload || {}) as { items?: unknown[] };
          const batch = Array.isArray(page.items) ? page.items : [];
          items.push(...batch);
          if (batch.length < JOB_EVENTS_PAGE_SIZE) {
            return {
              ...(typeof payload === "object" && payload ? payload : {}),
              items,
              offset: 0,
              limit: items.length,
            };
          }
          offset += batch.length;
        }
      })()
        .then((payload) => {
          state.eventsPayload = payload;
          return payload;
        })
        .catch((error) => {
          setEventsStatus(error.message || "Failed to read the event stream.");
          throw error;
        })
        .finally(() => {
          state.eventsLoadingPromise = null;
        });
    }
    return state.eventsLoadingPromise;
  }, [dataPort]);

  const handleOpenEvents = useCallback(async () => {
    setEventsOpen(true);
    try {
      const payload = await ensureEventsLoaded();
      setEventsPayload(payload);
      setEventsStatus(eventsStatusText(payload));
      setOpenEventsText("View");
    } catch (_error) {
      // Failure copy is already written in ensureEventsLoaded
    }
  }, [ensureEventsLoaded]);

  // React event rewrite of old downloads.js bindProtectedDownloadLink
  const handleProtectedDownload = useCallback((fallbackNameFactory) => async (event) => {
    const link = event.currentTarget;
    const enabled = link?.getAttribute("aria-disabled") !== "true";
    const url = `${link?.href || ""}`.trim();
    if (!enabled || !url || url.endsWith("#")) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    const state = pageStateRef.current;
    const fallbackName = fallbackNameFactory(state.job?.job_id || "job");
    const downloadTarget = await prepareDownloadTarget(fallbackName);
    if (downloadTarget.kind === "aborted") {
      return;
    }
    try {
      showDownloadPreparing(fallbackName);
      const resp = await dataPort.fetchProtected(url);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Download failed: ${resp.status} ${text || "unknown error"}`);
      }
      const disposition = resp.headers.get("content-disposition") || "";
      const filename = fileNameFromDisposition(disposition, fallbackName);
      await saveResponseDownload(resp, {
        target: downloadTarget,
        filename,
        onProgress: ({ receivedBytes, totalBytes, percent, done }) => {
          if (done) {
            setText("detail-head-note", `Started saving ${filename}`);
            completeDownloadToast(filename);
            return;
          }
          updateDownloadProgress({ filename, receivedBytes, totalBytes, percent });
        },
      });
    } catch (error) {
      setText("detail-head-note", error.message || "Download failed");
      failDownloadToast(error.message || "Download failed");
    }
  }, [dataPort, setText]);

  return (
    <>
      <main className="detail-page">
        <DetailHeader t={t} links={links} onProtectedDownload={handleProtectedDownload} />
        <section className="detail-grid">
          <JobSummaryCard title="Run Information">
            <MetaRow label="Current Stage" id="detail-runtime-current-stage" value={t("detail-runtime-current-stage")} />
            <MetaRow label="Current stage time" id="detail-runtime-stage-elapsed" value={t("detail-runtime-stage-elapsed")} />
            <MetaRow label="Total Time" id="detail-runtime-total-elapsed" value={t("detail-runtime-total-elapsed")} />
            <MetaRow label="Retry Count" id="detail-runtime-retry-count" value={t("detail-runtime-retry-count")} />
            <MetaRow label="Last Transition" id="detail-runtime-last-transition" value={t("detail-runtime-last-transition")} />
            <MetaRow label="Terminal Reason" id="detail-runtime-terminal-reason" value={t("detail-runtime-terminal-reason")} />
            <MetaRow label="Input Protocol" id="detail-runtime-input-protocol" value={t("detail-runtime-input-protocol")} />
            <MetaRow label="Stage Schema" id="detail-runtime-stage-spec-version" value={t("detail-runtime-stage-spec-version")} />
            <MetaRow label="Formula Mode" id="detail-runtime-math-mode" value={t("detail-runtime-math-mode")} />
          </JobSummaryCard>
          <JobSummaryCard title="Failure Diagnostics">
            <MetaRow label="Summary" id="detail-failure-summary" value={t("detail-failure-summary")} />
            <MetaRow label="Category" id="detail-failure-category" value={t("detail-failure-category")} />
            <MetaRow label="Stage" id="detail-failure-stage" value={t("detail-failure-stage")} />
            <MetaRow label="Root Cause" id="detail-failure-root-cause" value={t("detail-failure-root-cause")} />
            <MetaRow label="Suggestion" id="detail-failure-suggestion" value={t("detail-failure-suggestion")} />
            <MetaRow label="Latest Log" id="detail-failure-last-log-line" value={t("detail-failure-last-log-line")} />
            <MetaRow label="Retryable" id="detail-failure-retryable" value={t("detail-failure-retryable")} />
          </JobSummaryCard>
          <ErrorNoticeCard t={t} />
          <ErrorDiagnostics />
          <ArtifactsSection />
          <MarkdownCard t={t} />
          <StageHistoryTriggerCard onOpen={() => setStageHistoryOpen(true)} />
          <EventsTriggerCard buttonText={openEventsText} onOpen={handleOpenEvents} />
        </section>
      </main>
      <StageHistoryModal open={stageHistoryOpen} job={job} onClose={() => setStageHistoryOpen(false)} />
      <EventsModal
        open={eventsOpen}
        eventsPayload={eventsPayload}
        status={eventsStatus}
        onClose={() => setEventsOpen(false)}
      />
      <DownloadToastHost />
    </>
  );
}





