// Stage workflow entries (Blueprint §2 features/status/; mirrors job-status-card-stage-flow.js
// syncStageFlow semantics; DOM contract preserves ids/classes——smoke relies on
// .status-stage-step[data-stage-key][aria-selected]).
//
// RetryAction not placed on Stage pill (crowded, easy to misalign layout); rendered by StatusCardEmbedded
// on the right side of the Progress text line, per "currently selected Stage".

import { useStatusCardIds } from "./status-card-ids-context.js";
import {
  isSelectableStatusStage,
  STATUS_STAGE_FLOW,
  STATUS_STAGE_LABELS,
  statusStageIndex,
} from "../../composition/external.js";

/** @deprecated Retry moved out of StageFlow; keep Type to avoid old imports breaking */
export type StageFlowRetryAction = {
  label: string;
  enabled: boolean;
  title?: string;
  onRetry: () => void;
};

type StageFlowProps = {
  currentStageKey?: string;
  selectedStageKey?: string;
  onSelectStage?: (stageKey: string) => void;
  /** Override context id; defaults to StatusCardIdsContext */
  id?: string;
  /** @deprecated Ignored; Retry rendered by outer Progress area */
  stageRetries?: Partial<Record<string, StageFlowRetryAction | null | undefined>>;
};

export function StageFlow({
  currentStageKey = "",
  selectedStageKey = "",
  onSelectStage,
  id,
}: StageFlowProps) {
  const ids = useStatusCardIds();
  const flowId = id !== undefined ? id : ids.stageFlow;
  const normalized = `${currentStageKey || ""}`.trim();
  const selected = `${selectedStageKey || ""}`.trim();
  const activeIndex = statusStageIndex(normalized);

  return (
    <div id={flowId || undefined} className="status-stage-flow" role="tablist" aria-label="Task Workflow">
      {STATUS_STAGE_FLOW.map((stageKey) => {
        const stepIndex = statusStageIndex(stageKey);
        const isDone = activeIndex >= 0 && stepIndex >= 0 && stepIndex < activeIndex;
        const isActive = activeIndex >= 0 && stepIndex === activeIndex;
        const isSelected = Boolean(selected) && stageKey === selected;
        const selectable = isSelectableStatusStage(stageKey, normalized);
        const classNames = ["status-stage-step"];
        if (isDone) classNames.push("is-done");
        if (isActive) classNames.push("is-active");
        if (isSelected) classNames.push("is-selected");
        if (!selectable) classNames.push("is-disabled");
        return (
          <button
            key={stageKey}
            type="button"
            className={classNames.join(" ")}
            role="tab"
            data-stage-key={stageKey}
            disabled={!selectable}
            aria-selected={isSelected ? "true" : "false"}
            onClick={() => {
              if (selectable) {
                onSelectStage?.(stageKey);
              }
            }}
          >
            <span className="status-stage-step-name">{STATUS_STAGE_LABELS[stageKey]}</span>
          </button>
        );
      })}
    </div>
  );
}




