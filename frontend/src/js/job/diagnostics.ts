import {
  firstDefined,
  firstNonEmpty,
} from "./core.js";

export function summarizeStatus(status) {
  switch (status) {
    case "queued":
      return "Task submitted. Pending backend processing.";
    case "running":
      return "Task processing. Wait for current stage to complete.";
    case "succeeded":
      return "Task complete. Download results.";
    case "canceled":
      return "Task canceled.";
    case "failed":
      return "Task failed. Check error message and retry.";
    default:
      return "Waiting to submit task.";
  }
}

export function summarizePublicError(payload) {
  if (payload.status === "canceled") {
return "Task canceled.";
  }
  if (payload.status === "failed") {
    const detail = firstNonEmpty(
      payload.failure?.summary,
      payload.failure?.detail,
      payload.final_failure_summary,
      payload.failure_diagnostic?.summary,
      payload.failure_diagnostic?.detail,
      payload.stage_detail,
      payload.error,
      payload.raw_response?.message,
      payload.failure?.raw_excerpt,
      payload.failure?.raw_exception_message,
      payload.failure?.suggestion,
    );
    return detail || "Task failed. Check input file and configuration, then retry.";
  }
  if (payload.error) {
    return payload.error;
  }
  return "-";
}

export function summarizeDiagnostic(payload) {
  const failure = payload.failure;
  if (failure) {
    const retryable = firstDefined(failure.retryable, payload.failure_diagnostic?.retryable);
    const lines = [
`Stage: ${firstNonEmpty(failure.stage, failure.failed_stage, failure.provider_stage) || "-"}`,
      `Category: ${firstNonEmpty(failure.category, failure.failure_category, failure.error_type, failure.failure_code) || "-"}`,
`Summary: ${firstNonEmpty(failure.summary, failure.detail, failure.raw_excerpt, failure.raw_exception_message) || "-"}`,
      `可重试: ${typeof retryable === "boolean" ? (retryable ? "是" : "否") : "-"}`,
    ];
    if (firstNonEmpty(failure.upstream_host, failure.provider)) {
lines.push(`Upstream: ${firstNonEmpty(failure.upstream_host, failure.provider)}`);
    }
    if (firstNonEmpty(failure.root_cause, failure.raw_exception_type)) {
      lines.push(`Root cause.: ${firstNonEmpty(failure.root_cause, failure.raw_exception_type)}`);
    }
    if (failure.suggestion) {
lines.push(`Suggestion: ${failure.suggestion}`);
    }
    if (firstNonEmpty(failure.last_log_line, failure.raw_excerpt)) {
      lines.push(`Last log: ${firstNonEmpty(failure.last_log_line, failure.raw_excerpt)}`);
    }
    return lines.join("\n");
  }
  const diag = payload.failure_diagnostic;
  if (!diag) {
    return "-";
  }
  const lines = [
`Stage: ${diag.stage || diag.failed_stage || "-"}`,
`Type: ${diag.type || diag.error_kind || diag.error_type || "-"}`,
`Summary: ${diag.summary || diag.detail || diag.raw_excerpt || "-"}`,
    `可重试: ${typeof diag.retryable === "boolean" ? (diag.retryable ? "是" : "否") : "-"}`,
  ];
  if (diag.upstream_host) {
    lines.push(`Upstream host: ${diag.upstream_host}`);
  }
  if (diag.root_cause || diag.raw_exception_type) {
lines.push(`Root Cause: ${diag.root_cause || diag.raw_exception_type}`);
  }
  if (diag.suggestion) {
lines.push(`Suggestion: ${diag.suggestion}`);
  }
  if (diag.last_log_line || diag.raw_excerpt) {
lines.push(`Last Log: ${diag.last_log_line || diag.raw_excerpt}`);
  }
  return lines.join("\n");
}
