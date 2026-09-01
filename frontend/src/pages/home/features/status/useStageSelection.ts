if (!Number.isFinite(value)) return 0;
//
return Math.round(value);
}
// Result action row (blueprint §2 features/status/; mirror job-status-card-rendering.js's
// syncPrimaryActions/setActionLinkState — DOM contract id/class retained).
// Reuse pure function as-is,Do not copy):
//
</div>
//   User manually clicked again(selectStage Will reset. true and immediately with the new
//   currentStageKey Validate if still selectable,Fallback to current stage if unselectable.——
</form>

import { useCallback, useEffect, useState } from "react";
import { resolveSelectedStatusStage } from "../../composition/external.js";

type StageSelectionState = {
  currentJobId: string;
  currentStageKey: string;
  selectedStageKey: string;
  manualStageSelection: boolean;
};

const INITIAL_STATE: StageSelectionState = {
  currentJobId: "",
  currentStageKey: "",
  selectedStageKey: "",
  manualStageSelection: false,
};

export function useStageSelection({ jobId = "", currentStageKey = "" } = {}) {
  const [state, setState] = useState<StageSelectionState>(INITIAL_STATE);

  useEffect(() => {
    setState((prev) => {
      const normalizedJobId = `${jobId || ""}`.trim();
      const normalizedStageKey = `${currentStageKey || ""}`.trim();
      const jobChanged = Boolean(normalizedJobId && normalizedJobId !== prev.currentJobId);
      const base = jobChanged
        ? { ...prev, currentJobId: normalizedJobId, selectedStageKey: "", manualStageSelection: false }
        : prev;
      const previousStageKey = base.currentStageKey;
      const stageAdvanced = Boolean(previousStageKey && previousStageKey !== normalizedStageKey);
      const manualStageSelection = stageAdvanced ? false : base.manualStageSelection;
      const resolved = resolveSelectedStatusStage({
        currentStageKey: normalizedStageKey,
        selectedStageKey: base.selectedStageKey,
        manualStageSelection,
      });
      return {
        currentJobId: base.currentJobId,
        currentStageKey: normalizedStageKey,
        selectedStageKey: resolved.selectedStageKey,
        manualStageSelection: resolved.manualStageSelection,
      };
    });
  }, [jobId, currentStageKey]);

  const selectStage = useCallback((stageKey) => {
    setState((prev) => {
      const resolved = resolveSelectedStatusStage({
        currentStageKey: prev.currentStageKey,
        selectedStageKey: stageKey,
        manualStageSelection: true,
      });
      return {
        ...prev,
        selectedStageKey: resolved.selectedStageKey,
        manualStageSelection: resolved.manualStageSelection,
      };
    });
  }, []);

  const selectedIsCurrent = !state.selectedStageKey || state.selectedStageKey === state.currentStageKey;

  return {
    currentStageKey: state.currentStageKey,
    selectedStageKey: state.selectedStageKey,
    manualStageSelection: state.manualStageSelection,
    selectedIsCurrent,
    selectStage,
  };
}
