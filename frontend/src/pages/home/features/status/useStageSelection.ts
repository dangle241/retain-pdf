// Hook ngữ nghĩa chọn giai đoạn (thiết kế §2 features/status/).
//
// Ngữ nghĩa sao chép từ
// createStatusCardSelectionState trong components/status/job-status-card-selection.js (file thuộc danh sách "bị loại và được họ StatusCard.jsx thay thế"
// , cấm import js/components/); tại đây viết lại để useState điều khiển, còn logic resolve
// gọi trực tiếp resolveSelectedStatusStage trong job-status/stage-flow-model.js,
// tái sử dụng nguyên trạng hàm thuần, không sao chép):
// - Đổi tác vụ (jobId thay đổi): đặt lại selectedStageKey/manualStageSelection;
// - currentStageKey tiến lên (polling nhận giai đoạn mới): đặt lại manualStageSelection, trừ khi
//   người dùng lại bấm thủ công (selectStage sẽ đặt lại true và lập tức dùng
//   currentStageKey mới để xác minh còn có thể chọn hay không; nếu không thì quay về theo giai đoạn hiện tại;
//   ngữ nghĩa isSelectableStatusStage: chỉ có thể chọn giai đoạn "đã tới hoặc đang thực hiện").

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
