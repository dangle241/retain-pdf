// Failed tab "Resume from checkpoint / rerun" button binding (blueprint §1.2). resume-actions.js
// (kept) already computed enabled/status into overview.rerun; this only handles
// the disabled = !enabled || rerunPending combination and click dispatch, without
// recomputing anything.

export function useRerunAction({ overview, rerunPending, controller }) {
  const rerun = overview.rerun || { enabled: false, status: "" };
  return {
    enabled: Boolean(rerun.enabled),
    status: rerun.status || "",
    disabled: !rerun.enabled || Boolean(rerunPending),
    run: () => controller.rerunCurrentJob(),
  };
}


