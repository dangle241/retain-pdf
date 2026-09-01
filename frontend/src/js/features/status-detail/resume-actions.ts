import {
  firstNonEmptyText,
} from "./formatters.js";

function firstJobIdFromPayload(payload) {
  return firstNonEmptyText(
    payload?.job_id,
    payload?.data?.job_id,
    payload?.job?.job_id,
    payload?.job?.id,
    payload?.id,
  );
}

export function summarizeResumePlan(plan) {
  if (!plan) {
    return "";
  }
  if (!plan.can_resume) {
    return plan.reason || "The current job cannot resume from a checkpoint.";
  }
  const fromStage = firstNonEmptyText(plan.from_stage, plan.resume_from, "checkpoint");
  const workflow = firstNonEmptyText(plan.resume_workflow, plan.workflow);
  const reruns = Array.isArray(plan.reruns_stages) ? plan.reruns_stages.join(", ") : "";
  const bits = [`Can resume from ${fromStage} resume`];
  if (workflow) {
    bits.push(`workflow=${workflow}`);
  }
  if (reruns) {
    bits.push(`rerun ${reruns}`);
  }
  return bits.join(", ");
}

export function syncRerunAction({
  job = null,
  resumePlan = null,
  statusText = "",
  viewPort,
  resolveActions = () => ({}),
}: any = {}) {
  const actions = job ? resolveActions(job) : {};
  const enabled = Boolean(resumePlan?.can_resume || (actions.rerunEnabled && actions.rerun));
  viewPort.setRerunAction({
    enabled,
    status: statusText || (enabled
      ? summarizeResumePlan(resumePlan) || "The backend can create a resumed job from current job artifacts."
      : summarizeResumePlan(resumePlan) || "The current job cannot resume from a checkpoint."),
  });
  return actions.rerun || "";
}

export async function rerunCurrentJob({
  rerunContext,
  rerunJob,
  setText,
  startPolling,
  viewPort,
  resolveActions = () => ({}),
}: any = {}) {
  const actionUrl = syncRerunAction({
    ...rerunContext,
    statusText: "Submitting resumed job...",
    viewPort,
    resolveActions,
  });
  viewPort.setRerunDisabled(true);
  if (!actionUrl) {
    syncRerunAction({
      ...rerunContext,
      statusText: "The current job cannot resume from a checkpoint.",
      viewPort,
      resolveActions,
    });
    return;
  }
  try {
    const payload = await rerunJob(actionUrl);
    const nextJobId = firstJobIdFromPayload(payload);
    if (!nextJobId) {
      syncRerunAction({
        ...rerunContext,
        statusText: "Resume job submitted, but the response did not include job_id.",
        viewPort,
        resolveActions,
      });
      return;
    }
    viewPort.closeDialog();
    setText?.("error-box", `Created resumed job ${nextJobId}, starting polling.`);
    startPolling?.(nextJobId);
  } catch (error) {
    syncRerunAction({
      ...rerunContext,
      statusText: error.message || String(error),
      viewPort,
      resolveActions,
    });
  }
}



