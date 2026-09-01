import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
import {
  createMockFavorite,
  deleteMockFavorite,
  getMockFavorites,
} from "../mock/documents.js";
import { buildApiEndpoint } from "./http.js";

// 必填:document_id, page_idx, block_id, quote_text(引文快照).
// job_id 不传时后端锚定Documents的 active_job_id——Reader里Favorite推荐不传.
export async function createFavorite(apiPrefix, payload = {}) {
  if (isMockMode()) {
    return createMockFavorite(payload);
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, "favorites"), {
    method: "POST",
    headers: {
      ...buildApiHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const envelope = await resp.json().catch(() => null);
    throw new Error(`${envelope?.message || "Failed to create favorite. Please retry later."}(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

// 传 documentId 时按pages码Sort;不传 = AllFavorite,按Time倒序
export async function fetchFavorites(apiPrefix, { documentId = "" } = {}) {
  if (isMockMode()) {
    return getMockFavorites({ documentId });
  }
  const params = new URLSearchParams();
  if (`${documentId || ""}`.trim()) {
    params.set("document_id", `${documentId}`.trim());
  }
  const query = params.toString();
  const resp = await fetch(`${buildApiEndpoint(apiPrefix, "favorites")}${query ? `?${query}` : ""}`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`Failed to load favorites. Please retry later.(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function deleteFavorite(apiPrefix, favoriteId) {
  const normalized = `${favoriteId || ""}`.trim();
  if (!normalized) {
    throw new Error("Missing favorite_id.");
  }
  if (isMockMode()) {
    return deleteMockFavorite(normalized);
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, `favorites/${encodeURIComponent(normalized)}`), {
    method: "DELETE",
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`Failed to delete favorite. Please retry later.(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}




