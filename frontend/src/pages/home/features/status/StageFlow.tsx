// StageWorkflowentries(蓝图 §2 features/status/;镜像 job-status-card-stage-flow.js
// 的 syncStageFlow 语义,DOM 契约逐 id/class 保留——smoke 依赖
// .status-stage-step[data-stage-key][aria-selected]).
//
// RetryAction不放在Stage pill 上(拥挤, 易顶歪布局), 由 StatusCardEmbedded
// 在Progress文案行右侧按"Current选中Stage"单独Rendering.

import { useStatusCardIds } from "./status-card-ids-context.js";
import {
  isSelectableStatusStage,
  STATUS_STAGE_FLOW,
  STATUS_STAGE_LABELS,
  statusStageIndex,
} from "../../composition/external.js";

/** @deprecated Retry已迁出 StageFlow；保留Type以免旧 import 断裂 */
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
  /** 覆盖上下文 id；默认走 StatusCardIdsContext */
  id?: string;
  /** @deprecated 忽略；Retry由外层Progress区Rendering */
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
    <div id={flowId || undefined} className="status-stage-flow" role="tablist" aria-label="任务Workflow">
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




