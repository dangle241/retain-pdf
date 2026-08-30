// Nguồn dữ liệu phân trang cho lưới trung tâm tài liệu (kế hoạch F2). Hình dạng trả về khớp với
// recent-jobs/pagination.js#collectRecentJobsPage
// ({ collected, hasMore, latestInvocationSummary, nextOffset }), nhờ đó
// engine loader.js/commit.js/store của recent-jobs có thể dùng mà không cần sửa dòng nào.
//
// Tạo một thẻ cho mỗi tài liệu: trước tiên lấy một trang /documents, thu thập active_job_id trên trang rồi gọi hàng loạt
// library/books?job_ids= để lấy trạng thái sống của các job và hợp nhất theo job_id
// (shapeDocumentCardItem). Tài liệu chỉ có trong thư viện (không có active_job_id) dùng job_id tổng hợp để đi qua engine.
//
// Tìm kiếm: /documents hiện chưa có tìm kiếm văn bản phía máy chủ (chỉ lọc reading_status/tag/collection),
// nên query dùng **lọc tiêu đề/tên tệp ở client**; khi có query, lấy một batch lớn hơn để lọc và tắt
// phân trang tiếp. Tìm kiếm toàn văn/tiêu đề cấp tài liệu phía máy chủ là phần backend còn thiếu (xem memory
// f2-document-centric-grid-design)。

import { shapeDocumentsWithBooks } from "./shape-documents-with-books.js";

const SEARCH_FETCH_LIMIT = 200;

function normalizedJobId(value) {
  return `${value || ""}`.trim();
}

export async function collectDocumentLibraryPage({
  fetchDocumentList,
  fetchLibraryBookList,
  apiPrefix,
  startOffset = 0,
  pageSize,
  existingJobIds = new Set(),
  query = "",
}: any) {
  const trimmedQuery = `${query || ""}`.trim().toLowerCase();
  const searching = trimmedQuery.length > 0;
  const seen = existingJobIds instanceof Set
    ? new Set(existingJobIds)
    : new Set((Array.isArray(existingJobIds) ? existingJobIds : []).map(normalizedJobId).filter(Boolean));

  const limit = searching ? Math.max(pageSize, SEARCH_FETCH_LIMIT) : pageSize;
  const offset = searching ? 0 : startOffset;

  const payload = await fetchDocumentList(apiPrefix, { limit, offset });
  const documents = Array.isArray(payload?.documents) ? payload.documents : [];
  const total = Number.isFinite(Number(payload?.total)) ? Number(payload.total) : documents.length;

  // Ánh xạ tài liệu → thẻ dùng luồng thống nhất (shapeDocumentsWithBooks); loại trùng/lọc tìm kiếm là
  // mối quan tâm riêng của nguồn dữ liệu phân trang và được giữ bên dưới.
  const shaped = await shapeDocumentsWithBooks(documents, { fetchLibraryBookList, apiPrefix });

  const collected = [];
  for (const item of shaped) {
    const key = normalizedJobId(item.job_id);
    if (!key || seen.has(key)) {
      continue;
    }
    if (searching) {
      const haystack = `${item.title || ""} ${item.display_name || ""} ${item.source_file_name || ""}`.toLowerCase();
      if (!haystack.includes(trimmedQuery)) {
        continue;
      }
    }
    seen.add(key);
    collected.push(item);
  }

  const hasMore = searching
    ? false
    : documents.length > 0 && offset + documents.length < total;
  const nextOffset = searching ? startOffset : startOffset + pageSize;

  return {
    collected,
    hasMore,
    latestInvocationSummary: null,
    nextOffset,
  };
}
