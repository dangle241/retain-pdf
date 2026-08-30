import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
import { getMockSearchHits } from "../mock/documents.js";
import { buildApiEndpoint } from "./http.js";

// Tìm kiếm toàn văn (tiếng Trung và tiếng Anh). Từ khớp trong snippet được bọc bằng [ ]; lớp hiển thị thay bằng thẻ tô sáng.
// q có độ dài bất kỳ đều tìm được (≥3 ký tự dùng chỉ mục toàn văn; ngắn hơn thì backend tự chuyển sang khớp mờ).
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
    throw new Error(`Tìm kiếm thất bại, vui lòng thử lại sau. (${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}
