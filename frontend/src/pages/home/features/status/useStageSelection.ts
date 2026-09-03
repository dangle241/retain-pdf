// Stage selection semantics hook (Blueprint §2 features/status/).
//
// Semantics copied from components/status/job-status-card-selection.js
// createStatusCardSelectionState (that file is "dead", on the "to be replaced by
// StatusCard.jsx family" list; js/components/ prohibits import——rewritten here as useState-driven;
// resolve logic itself directly calls job-status/stage-flow-model.js resolveSelectedStatusStage,
// a pure function reused as-is, not copied):
// - Job switch (jobId changes): selectedStageKey/manualStageSelection reset;
// - currentStageKey advances (poll hits new Stage): manualStageSelection resets, unless
//   the user manually clicks again (selectStage re-sets to true and immediately validates
//   with the new currentStageKey whether it's still selectable; if not, falls back to
//   following current Stage——isSelectableStatusStage semantics: can only select
//   Stages that are "arrived at or in progress").

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


