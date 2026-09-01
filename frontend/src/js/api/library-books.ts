import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
import { countMockFavoritesByJob } from "../mock/documents.js";
import { getMockJobList } from "../mock/index.js";
import { buildApiEndpoint } from "./http.js";

export async function fetchLibraryBookList(apiPrefix, { limit = 40, offset = 0, q = "", jobIds = [] } = {}) {
  if (isMockMode()) {
    return getMockJobList({ jobIds });
  }
  const params = new URLSearchParams();
  params.set("limit", `${limit}`);
  params.set("offset", `${offset}`);
  if (`${q || ""}`.trim()) {
    params.set("q", `${q || ""}`.trim());
  }
  if (Array.isArray(jobIds) && jobIds.length) {
    params.set("job_ids", jobIds.map((id) => `${id}`.trim()).filter(Boolean).join(","));
  }
  const resp = await fetch(`${buildApiEndpoint(apiPrefix, "library/books")}?${params.toString()}`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`读取图书馆失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function deleteLibraryBook(apiPrefix, jobId, { force = false } = {}) {
  const normalizedJobId = `${jobId || ""}`.trim().replace(/-ocr$/, "");
  if (!normalizedJobId) {
    throw new Error("删除失败: 缺少 job_id");
  }
  if (isMockMode()) {
    const referenced = countMockFavoritesByJob(normalizedJobId);
    if (referenced > 0 && !force) {
      const conflict = new Error(`该 job 被 ${referenced} 条收藏引用(409)`) as Error & { status?: number };
      conflict.status = 409;
      throw conflict;
    }
    return { job_id: normalizedJobId };
  }
  const params = force ? "?force=true" : "";
  const resp = await fetch(`${buildApiEndpoint(apiPrefix, `library/books/${encodeURIComponent(normalizedJobId)}`)}${params}`, {
    method: "DELETE",
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    // 409 = 该 job 被收藏引用(删除保护),message 里带引用数量,必须透传给 UI
    const envelope = await resp.json().catch(() => null);
    const error = new Error(`${envelope?.message || "删除任务失败，请稍后重试。"}(${resp.status})`) as Error & { status?: number };
    error.status = resp.status;
    throw error;
  }
  return unwrapEnvelope(await resp.json());
}
