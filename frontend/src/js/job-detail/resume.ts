import { $ } from "../dom/query.js";
import { firstJobIdFromPayload, firstNonEmptyText, buildDetailPageUrl } from "./routing.js";

export function summarizeResumePlan(plan) {
  if (!plan) {
    return "Current task cannot be resumed.";
  }
  if (!plan.can_resume) {
return plan.reason || "Current task cannot be recovered.";
  }
  const fromStage = firstNonEmptyText(plan.from_stage, plan.resume_from, "checkpoint");
  const workflow = firstNonEmptyText(plan.resume_workflow, plan.workflow);
  const reruns = Array.isArray(plan.reruns_stages) ? plan.reruns_stages.join("、") : "";
const bits = [`Recoverable from ${fromStage}`];
  if (workflow) {
    bits.push(`workflow=${workflow}`);
  }
  if (reruns) {
bits.push(`Rerun ${reruns}`);
  }
  return bits.join("，");
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
setText("detail-rerun-status", "Current task cannot be recovered from breakpoint.");
      return;
    }
    button.disabled = true;
setText("detail-rerun-status", "Submitting recovery task...");
    try {
      const payload = await resumePort.submit({ actionUrl, jobId });
      const nextJobId = firstJobIdFromPayload(payload);
      if (!nextJobId) {
setText("detail-rerun-status", "Recovery task submitted, but no job_id in response.");
        return;
      }
setText("detail-rerun-status", `Recovery task ${nextJobId} created, redirecting......`);
      window.location.href = buildDetailPageUrl(nextJobId);
    } catch (error) {
      setText("detail-rerun-status", error.message || String(error));
      button.disabled = false;
    }
  });
}
