import {
  firstDefined,
  firstNonEmpty,
} from "./core.js";

export function summarizeStatus(status) {
  switch (status) {
    case "queued":
      return "Job submitted. Waiting for the backend to start processing.";
    case "running":
      return "The job is processing. Wait for the current stage to finish.";
    case "succeeded":
      return "The job is complete. Results are ready to download.";
    case "canceled":
      return "The job was canceled.";
    case "failed":
      return "The job failed. Check the error details and retry.";
    default:
      return "Waiting for job submission.";
  }
}

export function summarizePublicError(payload) {
  if (payload.status === "canceled") {
    return "The job was canceled.";
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
    return detail || "The job failed. Check the input file and configuration, then retry.";
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
      `Retryable: ${typeof retryable === "boolean" ? (retryable ? "yes" : "no") : "-"}`,
    ];
    if (firstNonEmpty(failure.upstream_host, failure.provider)) {
      lines.push(`Upstream: ${firstNonEmpty(failure.upstream_host, failure.provider)}`);
    }
    if (firstNonEmpty(failure.root_cause, failure.raw_exception_type)) {
      lines.push(`Root Cause: ${firstNonEmpty(failure.root_cause, failure.raw_exception_type)}`);
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
    `Retryable: ${typeof diag.retryable === "boolean" ? (diag.retryable ? "yes" : "no") : "-"}`,
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
    lines.push(`Last log: ${diag.last_log_line || diag.raw_excerpt}`);
  }
  return lines.join("\n");
}



