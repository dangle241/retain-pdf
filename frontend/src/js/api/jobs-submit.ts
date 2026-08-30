import { buildJobsEndpoint, submitJson } from "./http.js";

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function assertGroupedJobPayload(payload) {
  if (!isObject(payload)) {
    throw new Error("Gửi yêu cầu thất bại: /api/v1/jobs yêu cầu phần thân là một đối tượng JSON.");
  }
  if (!payload.workflow || !isObject(payload.source)) {
    throw new Error("Gửi yêu cầu thất bại: /api/v1/jobs phải dùng JSON được nhóm, ít nhất gồm workflow và source.");
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
      `Gửi yêu cầu thất bại: /api/v1/jobs không còn chấp nhận trường phẳng cũ; đã phát hiện ${leakedLegacyFields.join(", ")}. Hãy đổi sang cấu trúc nhóm source/ocr/translation/render/runtime.`,
    );
  }
}

export async function submitJobRequest(apiPrefix, payload) {
  assertGroupedJobPayload(payload);
  return submitJson(buildJobsEndpoint(apiPrefix, "jobs"), payload);
}
