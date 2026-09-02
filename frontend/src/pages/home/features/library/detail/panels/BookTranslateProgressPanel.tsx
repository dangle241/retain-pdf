// Translation tab progress area: attachJobProgress (library domain) + StatusCardEmbedded.
//
// Mount #book-detail-job-status-card as long as there is a real job_id;
// for completed books, use fallbackItem to complete the done state (see status/merge-snapshot-with-fallback).

import { useEffect } from "react";
import { useHomeServices } from "../../../../home-services-context.js";
import { useStoreSnapshot } from "../../../../../../shared/react/use-store.js";
import { StatusCard } from "../../../status/StatusCard.jsx";
import { StageFlow } from "../../../status/StageFlow.jsx";
import type { LibraryCardItem } from "../../types.js";
import { isLibraryOnlyItem } from "../../../../composition/external.js";

function resolveJobId(item: LibraryCardItem = {}) {
  const raw = `${item.job_id || item.active_job_id || ""}`.trim();
  if (!raw || raw.startsWith("doc:")) return "";
  return raw;
}

/**
 * Whether to show the job progress card.
 * Show as long as there is a real job_id — don't block completed books with library_only
 * (some projections may have inaccurate library_only, but job_id is present).
 */
function shouldShowJobProgress(item: LibraryCardItem = {}) {
  const jobId = resolveJobId(item);
  if (!jobId) return false;
  // Explicit library and synthetic job ids are already filtered by resolveJobId
  // Show if there is a real job (succeeded / running / failed / even empty status)
  return true;
}

export interface BookTranslateProgressPanelProps {
  item?: LibraryCardItem;
  active?: boolean;
  dialogOpen?: boolean;
}

export function BookTranslateProgressPanel({
  item = {},
  active = true,
  dialogOpen = true,
}: BookTranslateProgressPanelProps) {
  const services = useHomeServices();
  const actions = services.library?.actions;
  const statusCardState = useStoreSnapshot(services.statusCard.store);
  const cardJobId = `${statusCardState?.snapshot?.jobId || ""}`.trim();

  const jobId = resolveJobId(item);
  const showProgress = shouldShowJobProgress(item);
  const libraryOnly = isLibraryOnlyItem(item);
  const itemStatus = `${item.status || ""}`.trim().toLowerCase();

  const cardStatus = `${statusCardState?.snapshot?.status || ""}`.trim().toLowerCase();
  const cardPollingActive = cardStatus === "running"
    || cardStatus === "queued"
    || cardStatus === "pending";

  // Silently pull job: only feed statusCardStore.
  // Note: clicking "retry xxx" switches to a new job_id; if statusCard is already running the new job, don't override with the old id.
  useEffect(() => {
    if (!dialogOpen || !showProgress || !jobId) return undefined;
    if (cardJobId === jobId) return undefined;
    if (cardJobId && cardPollingActive && cardJobId !== jobId) {
      return undefined;
    }
    actions?.attachJobProgress?.(jobId);
    return undefined;
    // Intentionally omit actions from deps (services reference is stable, avoid meaningless reruns)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, showProgress, jobId, cardJobId, cardPollingActive]);

  // Progress main stage is in details: only hide when the main status area is currently visible (avoid setVisible per-frame notification dead loop)
  useEffect(() => {
    if (!dialogOpen || !showProgress) return undefined;
    if (services.statusArea?.isVisible?.()) {
      services.statusArea.setVisible(false);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, showProgress]);

  // Not translated library: empty state
  if (!showProgress) {
    return (
      <div
        id="book-detail-translate-progress"
        className="book-translate-progress space-y-3 rounded-xl border border-border/60 px-4 py-3.5"
        data-state="idle"
        data-library-only={libraryOnly ? "true" : "false"}
        data-item-status={itemStatus || ""}
        data-job-id=""
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          TranslationWorkflow
        </p>
        {/* Empty state only keeps the "roadmap preview" (test contract locked), no longer rendering fake progress entries / 0% —
            the main reason for the gray-on-gray look of disabled dead machines stacked together */}
        <div className="pointer-events-none">
          <StageFlow
            id="book-detail-stage-flow"
            currentStageKey=""
            selectedStageKey=""
            onSelectStage={() => {}}
          />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Translation has not started yet. Select the entire book or a page scope below to start; live progress will appear here.
        </p>
      </div>
    );
  }

  // fallback: prefer the job currently playing on statusCard (including retry new id), avoid covering the done state with an old item
  const liveFallback = cardJobId && cardJobId !== jobId
    ? {
        ...item,
        job_id: cardJobId,
        active_job_id: cardJobId,
        library_only: false,
        status: cardStatus || item.status,
      }
    : item;

  // Has job: always mount the full StatusCard.
  // Parent Tabs.Content hides the panel with data-[state=inactive]:hidden, but the node remains in DOM
  // (developer tools can search for #book-detail-job-status-card).
  return (
    <div
      id="book-detail-translate-progress"
      className="book-translate-progress"
      data-job-id={cardJobId || jobId}
      data-state={itemStatus === "succeeded" && !cardPollingActive ? "succeeded" : "ready"}
      data-item-status={itemStatus || ""}
      data-library-only={libraryOnly ? "true" : "false"}
      data-tab-active={active ? "true" : "false"}
    >
      <div className="book-detail-status-card-host">
        <StatusCard
          visible
          embedded
          idPrefix="book-detail-"
          rootId="book-detail-job-status-card"
          fallbackItem={liveFallback}
          showHiddenContract={false}
          showResultActions={false}
        />
      </div>
    </div>
  );
}




