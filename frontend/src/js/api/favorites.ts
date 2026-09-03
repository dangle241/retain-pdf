import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
import {
  createMockFavorite,
  deleteMockFavorite,
  getMockFavorites,
} from "../mock/documents.js";
import { buildApiEndpoint } from "./http.js";

// Required: document_id, page_idx, block_id, quote_text (citation snapshot).
// If job_id omitted, backend anchors to the document's active_job_id — Reader favorites should omit it.
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

// With documentId: sort by page number; without: all favorites, newest first
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




