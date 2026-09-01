import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
import { getMockSearchHits } from "../mock/documents.js";
import { buildApiEndpoint } from "./http.js";

// 全文检索(中英文)。命中词在 snippet 里用 [ ] 包裹,由展示层替换为高亮标签。
// 任意长度的 q 都可查(≥3 字符走全文索引,更短由后端自动回退模糊匹配)。
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
    throw new Error(`检索失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}
