import { buildJobsEndpoint, submitJson } from "./http.js";

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function assertGroupedJobPayload(payload) {
  if (!isObject(payload)) {
    throw new Error("Submit failed: /api/v1/jobs requires a JSON object request body.");
  }
  if (!payload.workflow || !isObject(payload.source)) {
    throw new Error("Submit failed: /api/v1/jobs must use grouped JSON and include at least workflow and source.");
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
      `Submit failed: /api/v1/jobs no longer accepts legacy flat fields, found ${leakedLegacyFields.join(", ")}.use grouped source/ocr/translation/render/runtime sections instead.`,
    );
  }
}

export async function submitJobRequest(apiPrefix, payload) {
  assertGroupedJobPayload(payload);
  return submitJson(buildJobsEndpoint(apiPrefix, "jobs"), payload);
}



