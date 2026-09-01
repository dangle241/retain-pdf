import { buildJobsEndpoint, submitJson } from "./http.js";

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function assertGroupedJobPayload(payload) {
  if (!isObject(payload)) {
throw new Error("Submission failed: /api/v1/jobs requires JSON object request body.");
  }
  if (!payload.workflow || !isObject(payload.source)) {
throw new Error("Submission failed: /api/v1/jobs requires grouped JSON containing at least workflow and source.");
  }
  const legacyTopLevelFields = [
    "upload_id",
    "artifact_job_id",
    "mode",
    "model",
    "base_url",
    "api_key",
    "mineru_token",
    "paddle_token",
    "model_version",
    "language",
    "render_mode",
    "skip_title_translation",
    "batch_size",
    "workers",
    "classify_batch_size",
    "compile_workers",
    "rule_profile_name",
    "custom_rules_text",
    "timeout_seconds",
  ];
  const leakedLegacyFields = legacyTopLevelFields.filter((field) => field in payload);
  if (leakedLegacyFields.length > 0) {
    throw new Error(
      `提交失败: /api/v1/jobs Flat fields no longer accepted. Detect and reject. ${leakedLegacyFields.join(", ")}Please change to source/ocr/translation/render/runtime Group Structure.`,
    );
  }
}

export async function submitJobRequest(apiPrefix, payload) {
  assertGroupedJobPayload(payload);
  return submitJson(buildJobsEndpoint(apiPrefix, "jobs"), payload);
}
