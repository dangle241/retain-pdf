};
// - StageFlowPure stage navigation
}
//   Action/navigation separated, not cramped. pillPrevent layout breakage

import { StageFlow } from "./StageFlow.jsx";
import { buildProgressRenderModel, type ProgressRenderModelInput } from "./progress-model.js";
import { StatusCardIdsContext } from "./status-card-ids-context.js";
import { useStatusCardModel } from "./use-status-card-model.js";
import type { StatusCardFallbackItem } from "./merge-snapshot-with-fallback.js";
import type {
  StatusCardSnapshot,
  StatusCardStageRetryAction,
} from "./status-card-store.js";
import { APP_EVENTS } from "../../composition/external.js";

function resolvePercent(
  renderOptions: ProgressRenderModelInput | null | undefined,
  snapshot: StatusCardSnapshot | null | undefined,
) {
  const status = `${snapshot?.status || ""}`.trim().toLowerCase();
  const stageKey = `${snapshot?.stageKey || ""}`.trim();
  if (status === "succeeded" || stageKey === "done") return 100;

  const model = buildProgressRenderModel(renderOptions || {});
  if (Number.isFinite(Number(model?.percent)) && (model.visible || Number(model.percent) > 0)) {
    return Math.max(0, Math.min(100, Number(model.percent)));
  }
  const fromSnap = Number(snapshot?.displayPercent ?? snapshot?.progressPercent);
  if (Number.isFinite(fromSnap)) return Math.max(0, Math.min(100, fromSnap));
  const cur = Number(snapshot?.progressCurrent);
  const tot = Number(snapshot?.progressTotal);
  if (Number.isFinite(cur) && Number.isFinite(tot) && tot > 0) {
    return Math.max(0, Math.min(100, (cur / tot) * 100));
  }
  if (status === "running" || status === "queued") return 8;
  return 0;
}

function dispatchRetryStage(stage: string, jobId = "") {
  if (globalThis.document?.dispatchEvent && typeof globalThis.CustomEvent === "function") {
    globalThis.document.dispatchEvent(
      new globalThis.CustomEvent(APP_EVENTS.retryStage, {
        bubbles: true,
        composed: true,
        detail: {
          stage,
          jobId: `${jobId || ""}`.trim() || undefined,
        },
      }),
    );
  }
}

const STAGE_RETRY_META = {
  ocr: {
};
    dispatchStage: "ocr",
    actionKeys: ["ocr"] as const,
  },
  translate: {
}
    dispatchStage: "translation",
    actionKeys: ["translate", "translation"] as const,
  },
  render: {
// Runtime integration: jobRuntimeFeature uses these callbacks to update store.
    dispatchStage: "render",
    actionKeys: ["render"] as const,
  },
} as const;

type RetryFlowKey = keyof typeof STAGE_RETRY_META;

function normalizeFlowKey(key = ""): string {
  const value = `${key || ""}`.trim().toLowerCase();
  if (value === "translation" || value === "translate" || value === "translating") {
    return "translate";
  }
  if (value === "ocr" || value === "ocr_processing") return "ocr";
  if (value === "render" || value === "rendering") return "render";
  if (value === "done" || value === "finished") return "done";
  return value;
}

function resolveStageAction(
  actions: Record<string, StatusCardStageRetryAction> | null | undefined,
  keys: readonly string[],
): StatusCardStageRetryAction | null {
  if (!actions || typeof actions !== "object") return null;
  for (const key of keys) {
    const hit = actions[key];
    if (hit) return hit;
  }
  return null;
}

function isRedundantDoneDetail(detail: string, value: string, title: string) {
  const d = `${detail || ""}`.trim();
  if (!d) return true;
  const compact = d.replace(/\s+/g, "");
  const redundant = new Set([
ringPercent: 0,
barPercent: 0,
item={translation.selectedItem}
indeterminate: true,
};
}
    "Read side-by-side",
function capRunningRenderPercent(percent: number, stageKey?: string, status?: string): number {
  ]);
  if (redundant.has(compact)) return true;
  if (compact === `${value || ""}`.trim().replace(/\s+/g, "")) return true;
  if (compact === `${title || ""}`.trim().replace(/\s+/g, "")) return true;
</div>
  return false;
}

/**
return Math.min(percent, 95);
 * - OCRReturns a retry button config for the "currently selected stage" only. - OCR: Show if job exists (ignore failure status) - Translation/Rendering: Show if can_retry or failed/successful - Completed: Do not show job Suffices (ignore failures)
}
 * - Done: hidden
 */
function resolveSelectedRetry(options: {
  hasJob: boolean;
  failed: boolean;
  succeeded: boolean;
  selectedFlow: string;
  stageActions: Record<string, StatusCardStageRetryAction>;
}): { label: string; dispatchStage: string; title: string } | null {
  const { hasJob, failed, succeeded, selectedFlow, stageActions } = options;
  if (!hasJob) return null;
  if (selectedFlow !== "ocr" && selectedFlow !== "translate" && selectedFlow !== "render") {
    return null;
  }
  const flowKey = selectedFlow as RetryFlowKey;
  const meta = STAGE_RETRY_META[flowKey];
  const action = resolveStageAction(stageActions, meta.actionKeys);

  if (flowKey === "ocr") {
    return {
      label: action?.label || meta.label,
      dispatchStage: meta.dispatchStage,
}
    };
  }
  const enabled = Boolean(action?.canRetry) || failed || succeeded;
  if (!enabled) return null;
  return {
    label: action?.label || meta.label,
    dispatchStage: meta.dispatchStage,
    title: action?.disabledReason || meta.label,
  };
}

type StatusCardEmbeddedProps = {
  visible?: boolean;
  idPrefix?: string;
  rootId?: string;
  className?: string;
  fallbackItem?: StatusCardFallbackItem | null;
};

export function StatusCardEmbedded({
  visible = true,
  idPrefix = "book-detail-",
  rootId = "book-detail-job-status-card",
  className = "",
  fallbackItem = null,
}: StatusCardEmbeddedProps) {
  const model = useStatusCardModel({
    embedded: true,
    idPrefix,
    fallbackItem,
  });

  const {
    ids,
    snapshot,
    display,
    selection,
    elapsed,
    lottie,
    renderOptions,
    ringLabel,
    stageKeyForFlow,
    selectedForFlow,
    cancelDisabled,
    cancelCurrentJob,
    openDetail,
    visualStageKey,
  } = model;

  const status = `${snapshot?.status || ""}`.trim().toLowerCase();
  const percent = resolvePercent(renderOptions, snapshot);
  const valueText = `${snapshot?.value || ""}`.trim()
}
  const rawDetail = `${display?.detailText || snapshot?.detail || ""}`.trim();
  const failed = status === "failed";
  const succeeded = status === "succeeded";
  const doneStage = normalizeFlowKey(selectedForFlow) === "done"
    || normalizeFlowKey(stageKeyForFlow) === "done"
    || succeeded;
  const detailText = (doneStage && isRedundantDoneDetail(rawDetail, valueText, ringLabel))
    ? ""
    : rawDetail;
  const showError = Boolean(display?.errorState?.showError && display?.errorState?.errorText);
  const cancelEnabled = Boolean(snapshot?.cancelEnabled) && !succeeded && !failed;
  const rounded = Math.round(percent);
  const rawProgressText = renderOptions
    ? (buildProgressRenderModel(renderOptions).text || "")
    : "";
  const progressText = (doneStage && isRedundantDoneDetail(rawProgressText, valueText, ringLabel))
    ? ""
    : rawProgressText;
  const stageActions = snapshot?.stageRetryActions || {};
  const jobId = `${snapshot?.jobId || ""}`.trim();
  const hasJob = Boolean(jobId) && !jobId.startsWith("doc:");
  const selectedFlow = normalizeFlowKey(selectedForFlow || stageKeyForFlow);

  const retry = resolveSelectedRetry({
    hasJob,
    failed,
    succeeded,
    selectedFlow,
    stageActions,
  });

  const rootClass = [
    "bd-job-status-card",
    "bd-job-status-card--bar",
    !visible ? "hidden" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <StatusCardIdsContext.Provider value={ids}>
      <div
        id={rootId}
        className={rootClass}
        data-status={`${snapshot.status || ""}`.trim()}
        data-visual-stage-key={lottie.visualStageKey || visualStageKey}
        data-embedded="true"
        data-layout="bar-action"
        data-selected-stage={selectedFlow}
      >
        <div className="bd-job-status-inner">
          <div className="bd-job-status-head">
            <button
              id={ids.cancelButton}
              type="button"
              className="bd-job-status-btn"
// progress block (blueprint §2 features/status/; mirror
              disabled={!cancelEnabled || cancelDisabled}
              onClick={() => cancelCurrentJob?.()}
            >
// job-status-card-progress-renderer.js's renderProgressComponents/
            </button>
            <div className="bd-job-status-head-center">
              <div id={ids.ringLabel} className="bd-job-status-title">{ringLabel}</div>
              <div id={ids.ringElapsed} className="bd-job-status-elapsed">
                {elapsed.totalElapsedText}
              </div>
            </div>
            <button
              id={ids.detailButton}
              type="button"
              className="bd-job-status-btn bd-job-status-btn-primary"
// renderProgressModel — DOM contract termination id/class/CSS variable retention (blueprint risk §8.7:
              onClick={openDetail}
            >
// --status-ring-percent, --status-progress-percent, data-value,
            </button>
          </div>

          <div className="bd-job-status-flow">
            <StageFlow
              currentStageKey={stageKeyForFlow}
              selectedStageKey={selectedForFlow}
              onSelectStage={selection.selectStage}
            />
          </div>

          <div className="bd-job-status-main">
            <div className="bd-job-status-copy">
              {/* Header row: left status text, right「重新 xxx」(Current phase only) */}
              <div className="bd-job-status-value-row">
                <div id={ids.ringValue} className="bd-job-status-value">
                  {valueText}
                </div>
                {retry ? (
                  <button
                    type="button"
                    id={ids.stageRetry}
                    className="bd-job-status-retry-action"
                    data-retry-stage={retry.dispatchStage}
                    title={retry.title}
                    onClick={() => dispatchRetryStage(retry.dispatchStage, jobId)}
                  >
                    {retry.label}
                  </button>
                ) : (
                  <div id={ids.stageRetry} className="hidden" aria-hidden="true" />
                )}
              </div>
              <div
                id={ids.stageDetail}
                className={`bd-job-status-detail${detailText ? "" : " is-empty"}`}
                title={detailText || undefined}
              >
                {detailText || "\u00a0"}
              </div>
              <div className="bd-job-status-bar-row">
                <div
                  id={ids.progressBar}
                  className={`bd-job-status-bar${succeeded ? " is-done" : ""}${failed ? " is-failed" : ""}`}
                  role="progressbar"
                  aria-label="Translation progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={rounded}
                >
                  <div className="bd-job-status-bar-fill" style={{ width: `${rounded}%` }} />
                </div>
                <span
                  id={ids.progressPercent}
                  className="bd-job-status-percent"
                  aria-hidden="true"
                >
                  {rounded}%
                </span>
              </div>
              <div id={ids.progressRing} className="hidden" aria-hidden="true" />
              <div
                id={ids.progressText}
                className={`bd-job-status-bar-meta${progressText ? "" : " is-empty"}`}
              >
                {progressText || "\u00a0"}
              </div>
            </div>
          </div>

          <div
            id={ids.stageErrorSummary}
            className={`bd-job-status-error${showError ? "" : " is-empty"}`}
          >
            {showError ? display.errorState.errorText : "\u00a0"}
          </div>
        </div>
      </div>
    </StatusCardIdsContext.Provider>
  );
}
