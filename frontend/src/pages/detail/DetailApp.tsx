// Task Details Page React Orchestration root (old src/js/job-detail/index.js + view.js +
// modal-bindings.js + downloads.js + events.js Launcher rewrite)。
//
// State strategy(As-is semantics,Do not import. store):
// - Old world pure logic(overview-renderer / markdown-flow / summary / action-links /
// resume etc.) via setText/setActionLink/setEventsStatus Write copy on callbackââhere put
// Callback implementation React state (texts/links 2 Mapping Tables), JSX Rendering by id Value;
// - Build artifacts, failure debug contextMarkdown Image grid still uses retained legacy module.
// (artifacts.js / failure.js, via overview-renderer / markdown-flow) After mount
// Imperative innerHTML write to React Rendered leaf container (see component comments);
// - Toggle modal, load event stream, switch to protected download React Manage(Original view.js /
//   modal-bindings.js / events.js Launcher / downloads.js responsibilities)。

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
return count > 0 ? `All Events Â· ${count} entries` : "All Events";
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
const [eventsStatus, setEventsStatus] = useState("Not Loaded");
const [openEventsText, setOpenEventsText] = useState("Load on Demand");

// Old view.js setDetailText Semantics: value ?? "-"
  const setText = useCallback((id, value) => {
    setTexts((prev) => ({ ...prev, [id]: value ?? "-" }));
  }, []);

// Old view.js setDetailActionLink semantics: href/disabled/aria-disabled 3-piece set
  const setActionLink = useCallback((id, url, enabled) => {
    setLinks((prev) => ({ ...prev, [id]: { url, enabled: Boolean(enabled) } }));
  }, []);

  const t = useCallback(
    (id, fallback = "-") => (Object.hasOwn(texts, id) ? texts[id] : fallback),
    [texts],
  );

// Page load orchestration.: Old index.js initializePage hooks rebuild
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
setText("detail-head-note", "Missing job_id, please open via detail.html?job_id=...");
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
// Old createPageRuntime onError semantics: Init exception header prompt
      setText("detail-head-note", error.message || String(error));
    });
    // Execute once on mount.;Port remains constant during page lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

// Old modal-bindings.js: Escape Close all modals.
  //
// Stage C Finalize Batch (shadcn refactor) decision: Swap modes Radix Dialog keep this
  // "Unconditionally close both"Handwritten listener,No change."Close current tab only."Reason:Each modal independently
// is fixed inset-0 independent Radix Root/Content, Used on open. DismissableLayer
  // Preemptively seize focus(focus trap)——StageHistoryModal Trigger card on open.
  // (EventsTriggerCard)Fully obscured by mask and unfocusable/Not clickable,Vice versa,So two
  // Modals mutually exclusive in this page structure.(At most one at a time open=true)This means
// "Close both." and "Close current only" Result identical across all reachable states.ââsetStageHistoryOpen/
  // setEventsOpen Already false One side call is idempotent. no-op,Won't happen. double-fire
  // Risk of semantic collapse(Different TranslationWorkflowDialog Two-step close unnecessary. Simplify.
// broken by "Call once more." scenarios breaking semantics) Keep as-is. Lowest risk in this refactor batch.
  // Create new branch for current task. UI Tighten unobservable behavior below.
  //
// This listener and Radix Own Escape Handle (DismissableLayer, capture phase) will
// Run all in single keystroke.: Radix Sort first "The currently open one" calls onOpenChange(false)
// (Corresponding setXxxOpen(false) takes effect), Here. bubble Listener calls both.
// One setXxxOpen(false)ââAlready is false One side is no-op, No extra renders or
  // Side effects,Two mechanisms do not conflict.
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

// Old view.js setDetailModalOpen body handwritten scroll locking implementation removed: Radix Dialog
// modal mode (default) Built-in equivalent. body Scroll Lock (react-remove-scroll, Mount
// on DialogPrimitive.Content, with Content real mount/unmount lifecycle automatically
// Lock/unlock, see EventsTimeline.jsx DetailModal) Keep this handwritten note.
  // document.body.style.overflow assignment will Radix Own locking mechanism creates two independent
// writer Race same resource CSS propertyââreact-remove-scroll Internally cached. "Before lock acquisition
// original overflow value "Restore precisely on unlock.", Direct assignment here/clear, May be in
  // reset this property to a value inconsistent with Radix inconsistent remembered value(Performance
  // After closing a modal body Scroll still broken.,Or vice versa)Two modals mutually exclusive (same as above),
  // Radix Lock granularity on-demand (corresponding Content Mounted state fully covers legacy intent.
// semantics, No longer requires manual entry.

// Old events.js fetchAllJobEvents + ensureEventsLoaded (Paginate to fetch all data. + page cache)
  const ensureEventsLoaded = useCallback(async () => {
    const state = pageStateRef.current;
    if (state.eventsPayload) {
      return state.eventsPayload;
    }
    if (!state.job?.job_id) {
throw new Error("Missing job_id. Cannot load event stream.");
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
          setEventsStatus(error.message || "Failed to read event stream.");
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
      // Failure copy present. ensureEventsLoaded Write to
    }
  }, [ensureEventsLoaded]);

// Old downloads.js bindProtectedDownloadLink React Event override
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
          <JobSummaryCard title="Filter">
            <MetaRow label="Current Stage" id="detail-runtime-current-stage" value={t("detail-runtime-current-stage")} />
            <MetaRow label="Current stage duration" id="detail-runtime-stage-elapsed" value={t("detail-runtime-stage-elapsed")} />
            <MetaRow label="Total elapsed time" id="detail-runtime-total-elapsed" value={t("detail-runtime-total-elapsed")} />
            <MetaRow label="retry count" id="detail-runtime-retry-count" value={t("detail-runtime-retry-count")} />
            <MetaRow label="Recent" id="detail-runtime-last-transition" value={t("detail-runtime-last-transition")} />
            <MetaRow label="Terminal state reason" id="detail-runtime-terminal-reason" value={t("detail-runtime-terminal-reason")} />
            <MetaRow label="Input" id="detail-runtime-input-protocol" value={t("detail-runtime-input-protocol")} />
            <MetaRow label="Stage Schema" id="detail-runtime-stage-spec-version" value={t("detail-runtime-stage-spec-version")} />
            <MetaRow label="Formula Mode" id="detail-runtime-math-mode" value={t("detail-runtime-math-mode")} />
          </JobSummaryCard>
          <JobSummaryCard title="Diagnosis Failed">
<MetaRow label="Summary" id="detail-failure-summary" value={t("detail-failure-summary")} />
            <MetaRow label="Categories" id="detail-failure-category" value={t("detail-failure-category")} />
<MetaRow label="Stage" id="detail-failure-stage" value={t("detail-failure-stage")} />
            <MetaRow label="root cause" id="detail-failure-root-cause" value={t("detail-failure-root-cause")} />
<MetaRow label="Suggestion" id="detail-failure-suggestion" value={t("detail-failure-suggestion")} />
            <MetaRow label="recent logs" id="detail-failure-last-log-line" value={t("detail-failure-last-log-line")} />
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
