import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
import { getMockSearchHits } from "../mock/documents.js";
import { buildApiEndpoint } from "./http.js";

// Full-text search (Chinese/English). Hits wrap matched words in [ ] in snippet; UI replaces with highlight tags.
// Any-length q is allowed (≥3 chars uses full-text index; shorter auto-falls back to fuzzy match on backend).
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
    throw new Error(`Search failed, Please retry later.(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}



