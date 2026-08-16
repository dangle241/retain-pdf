import { $ } from "../dom/query.js";
import { firstJobIdFromPayload, firstNonEmptyText, buildDetailPageUrl } from "./routing.js";

export function summarizeResumePlan(plan) {
  if (!plan) {
    return "Tác vụ hiện tại chưa thể khôi phục.";
  }
  if (!plan.can_resume) {
    return plan.reason || "Tác vụ hiện tại chưa thể khôi phục.";
  }
  const fromStage = firstNonEmptyText(plan.from_stage, plan.resume_from, "checkpoint");
  const workflow = firstNonEmptyText(plan.resume_workflow, plan.workflow);
  const reruns = Array.isArray(plan.reruns_stages) ? plan.reruns_stages.join("、") : "";
  const bits = [`Có thể tiếp tục từ ${fromStage}`];
  if (workflow) {
    bits.push(`workflow=${workflow}`);
  }
  if (reruns) {
    bits.push(`Chạy lại ${reruns}`);
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
      setText("detail-rerun-status", "Tác vụ hiện tại chưa thể tiếp tục từ điểm dừng.");
      return;
    }
    button.disabled = true;
    setText("detail-rerun-status", "Đang gửi tác vụ khôi phục...");
    try {
      const payload = await resumePort.submit({ actionUrl, jobId });
      const nextJobId = firstJobIdFromPayload(payload);
      if (!nextJobId) {
        setText("detail-rerun-status", "Đã gửi tác vụ khôi phục nhưng phản hồi không có job_id.");
        return;
      }
      setText("detail-rerun-status", `Đã tạo tác vụ khôi phục ${nextJobId}, đang chuyển trang...`);
      window.location.href = buildDetailPageUrl(nextJobId);
    } catch (error) {
      setText("detail-rerun-status", error.message || String(error));
      button.disabled = false;
    }
  });
}
