import { $ } from "../dom/query.js";
import { firstJobIdFromPayload, firstNonEmptyText, buildDetailPageUrl } from "./routing.js";

export function summarizeResumePlan(plan) {
  if (!plan) {
    return "The current job cannot be resumed.";
  }
  if (!plan.can_resume) {
    return plan.reason || "The current job cannot be resumed.";
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

export function bindRerunButton({
  detailPageState,
  getJobId,
  resumePort,
  setText,
}) {
  $("detail-rerun-btn")?.addEventListener("click", async () => {
    const button = $("detail-rerun-btn") as any;
    const jobId = detailPageState.job?.job_id || getJobId();
    const actionUrl = `${detailPageState.rerunActionUrl || ""}`.trim();
    if (!button || (!jobId && !actionUrl)) {
      setText("detail-rerun-status", "The current job cannot resume from a checkpoint.");
      return;
    }
    button.disabled = true;
    setText("detail-rerun-status", "Submitting resumed job...");
    try {
      const payload = await resumePort.submit({ actionUrl, jobId });
      const nextJobId = firstJobIdFromPayload(payload);
      if (!nextJobId) {
        setText("detail-rerun-status", "Resume job submitted, but the response did not include job_id.");
        return;
      }
      setText("detail-rerun-status", `Created resumed job ${nextJobId}, redirecting...`);
      window.location.href = buildDetailPageUrl(nextJobId);
    } catch (error) {
      setText("detail-rerun-status", error.message || String(error));
      button.disabled = false;
    }
  });
}



