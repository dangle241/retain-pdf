// canonical stores recalculate entire system. optimize first. write back snapshot statusCardStore (blueprint risk 10:
// (kept)already enabled/status Calculated and written into overview.rerun,here only do
// disabled = !enabled || rerunPending Combination and click dispatch,Avoid redundant calculation.

export function useRerunAction({ overview, rerunPending, controller }) {
  const rerun = overview.rerun || { enabled: false, status: "" };
  return {
    enabled: Boolean(rerun.enabled),
    status: rerun.status || "",
    disabled: !rerun.enabled || Boolean(rerunPending),
    run: () => controller.rerunCurrentJob(),
  };
}
