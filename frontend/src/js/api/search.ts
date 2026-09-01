import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
import { getMockSearchHits } from "../mock/documents.js";
import { buildApiEndpoint } from "./http.js";

// Full-text search: matched term in snippet is wrapped in [ ], replace display layer with highlight tags.
// Arbitrary length q All searchable(≥3 Full-text index for characters.,Backend auto-fallback fuzzy match.)。
export async function searchLibrary(apiPrefix, q, { limit = 20 } = {}) {
  const query = `${q || ""}`.trim();
  if (!query) {
    return { hits: [] };
  }
  if (isMockMode()) {
    return getMockSearchHits(query, { limit });
  }
  const params = new URLSearchParams();
  params.set("q", query);
  params.set("limit", `${limit}`);
  const resp = await fetch(`${buildApiEndpoint(apiPrefix, "search")}?${params.toString()}`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`Retrieval failed. Please try again later.(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}
