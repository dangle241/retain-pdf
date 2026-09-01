// Translation Tab progress area: attachJobProgress (library domain) + StatusCardEmbedded.
//
// Real only job_id Mount #book-detail-job-status-card；
// Book usage completed fallbackItem Complete terminal state (see status/merge-snapshot-with-fallback）。

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
 * Should display task progress card.
 * As long as it's real job_id Display only——Do not use library_only Filter completed books
 * Individual projection library_only May be inaccurate, but job_id in).
 */
function shouldShowJobProgress(item: LibraryCardItem = {}) {
  const jobId = resolveJobId(item);
  if (!jobId) return false;
// Clarify holdings and job: composite ID already filtered in resolveJobId
  // Real job i.e., display (succeeded / running / failed / even status Remove empty. Optimize.
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

  // Silent pull. Use `git pull --quiet`. jobFeed only. statusCardStore。
// Note: "Retry xxx" switches to new job_id; if statusCard is already running new job, don't overwrite with old id.
  useEffect(() => {
    if (!dialogOpen || !showProgress || !jobId) return undefined;
    if (cardJobId === jobId) return undefined;
    if (cardJobId && cardPollingActive && cardJobId !== jobId) {
      return undefined;
    }
    actions?.attachJobProgress?.(jobId);
    return undefined;
// Deliberately omit actions from deps (services stable reference prevents unnecessary reruns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, showProgress, jobId, cardJobId, cardPollingActive]);

  // Detail progress main venue: close only when main status area currently visible (avoid setVisible Notify infinite loop per frame
  useEffect(() => {
    if (!dialogOpen || !showProgress) return undefined;
    if (services.statusArea?.isVisible?.()) {
      services.statusArea.setVisible(false);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, showProgress]);

  // Untranslated collection: empty state
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
          Translation workflow
        </p>
        {/* Empty state only"Roadmap Preview""Test contract locked", no longer render fake progress bar./0%——
            Disabled dead machines stacked cause gray-on-gray visual clutter. */}
        <div className="pointer-events-none">
          <StageFlow
            id="book-detail-stage-flow"
            currentStageKey=""
            selectedStageKey=""
            onSelectStage={() => {}}
          />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Not started. Select full book or page range to begin; progress appears here in real time.
        </p>
      </div>
    );
  }

  // fallback: Prefer to follow the statusCard Now Playing jobRetry mechanism needed. Implement using existing retry library. → skipped: custom implementation, add when specific requirements arise. idToken expired. Use fresh token. item overwrite with completion state
  const liveFallback = cardJobId && cardJobId !== jobId
    ? {
        ...item,
        job_id: cardJobId,
        active_job_id: cardJobId,
        library_only: false,
        status: cardStatus || item.status,
      }
    : item;

  // has job: Always mount the full StatusCard。
// Parent Tabs.Content uses data-[state=inactive]:hidden to hide panel, nodes persist in DOM
  // (searchable in developer tools #book-detail-job-status-card）。
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
