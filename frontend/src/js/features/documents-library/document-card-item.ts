// Hình dạng mục thẻ trong lưới trung tâm tài liệu (F2 của kế hoạch wondrous-baking-donut.md).
//
// Điểm thiết kế (xem memory f2-document-centric-grid-design): lưới thư viện đổi thành "mỗi tài liệu
// một thẻ", nhưng lớp dưới dùng lại store/loại trùng/thăm dò theo job_id của features/recent-jobs
// mà không sửa dòng nào. Vì vậy:
// - Tài liệu đã dịch (active_job_id không rỗng): thẻ mang job_id thật và hợp nhất dữ liệu thời gian thực
//   status/stage/progress/cover từ library/books → cơ chế thăm dò/tiến độ/bìa hiện có tiếp quản nguyên trạng.
// - Tài liệu chỉ có trong thư viện (active_job_id là null/rỗng): cấp một **job_id namespace tổng hợp**
//   `doc:<document_id>` để đi nguyên vẹn qua dedupeRecentJobs/store loại trùng theo job_id,
//   không bị logic "bỏ ngay job_id rỗng" lọc mất; thẻ dùng nhánh boolean library_only cho trạng thái thư viện
//   (tắt đọc đối chiếu, hiển thị "Chưa dịch", dùng dịch/đọc nguyên văn), không phân tích id tổng hợp này.

import { flattenStageSnapshot } from "../../job/stage-snapshot-flatten.js";

export const LIBRARY_ONLY_JOB_PREFIX = "doc:";

export function syntheticLibraryJobId(documentId) {
  const normalized = `${documentId || ""}`.trim();
  return normalized ? `${LIBRARY_ONLY_JOB_PREFIX}${normalized}` : "";
}

export function isLibraryOnlyItem(item: any = {}) {
  return item?.library_only === true;
}

function firstUrl(...candidates) {
  for (const candidate of candidates) {
    const url = `${candidate || ""}`.trim();
    if (url) {
      return url;
    }
  }
  return "";
}

/** Nếu tiêu đề book là job_id / job_id.pdf / Mock…, dùng tên tài liệu thật. */
function pickCardTitle(bookTitle, document, jobId) {
  const book = `${bookTitle || ""}`.trim();
  const docTitle = `${document?.title || document?.source_filename || ""}`.trim();
  const id = `${jobId || ""}`.trim();
  const bookIsPlaceholder = !book
    || (id && (book === id || book === `${id}.pdf`))
    || /^Mock(\s|\u91cd\u8bd5|-|_)/i.test(book)
    || /^mock-/i.test(book);
  if (bookIsPlaceholder && docTitle) {
    return docTitle;
  }
  return book || docTitle || id || "";
}

// document + projection library/books tùy chọn → một mục thẻ lưới.
// Khi khớp book (đã dịch), ưu tiên trường trạng thái sống của book và bổ sung định danh tài liệu (document_id,
// reading_status, tags, source_pdf_url); khi thiếu book, tạo thẻ thư viện từ trường tài liệu.
export function shapeDocumentCardItem(document: any = {}, book = null) {
  const documentId = `${document.document_id || ""}`.trim();
  const activeJobId = `${document.active_job_id || ""}`.trim();
  const sharedDocFields = {
    document_id: documentId,
    reading_status: document.reading_status || "",
    tags: Array.isArray(document.tags) ? document.tags : [],
    source_pdf_url: document.source_pdf_url || "",
    bytes: document.bytes,
    added_at: document.added_at || "",
    last_opened_at: document.last_opened_at || null,
  };

  if (activeJobId && book && typeof book === "object") {
    // Đã dịch: ưu tiên trạng thái sống từ library/books (nhất quán với lưới hiện tại), bổ sung định danh tài liệu và
    // bìa dự phòng (book tổng hợp có thể không có cover_url, lùi về bìa cấp tài liệu).
    const flattened = flattenStageSnapshot(book);
    const jobId = `${flattened.job_id || book.job_id || activeJobId}`.trim();
    return {
      ...flattened,
      ...sharedDocFields,
      job_id: jobId,
      active_job_id: activeJobId,
      library_only: false,
      // Bìa/số trang: ưu tiên trạng thái sống của book, dự phòng cấp tài liệu (nhất quán với lưới hiện tại);
      // Tiêu đề: không cho book dùng job_id.pdf ghi đè tên sách thật.
      cover_url: firstUrl(flattened.cover_url, book.cover_url, document.cover_url),
      thumbnail_url: firstUrl(flattened.thumbnail_url, book.thumbnail_url, document.thumbnail_url),
      page_count: document.page_count || flattened.page_count || 0,
      updated_at: flattened.updated_at || document.updated_at || "",
      title: pickCardTitle(flattened.title || book.title, document, jobId),
      display_name: pickCardTitle(
        flattened.display_name || flattened.title || book.display_name || book.title,
        document,
        jobId,
      ),
    };
  }

  if (activeJobId) {
    // Có active_job_id nhưng library/books không có projection (trường hợp hiếm: job vừa tạo/bị xóa). Giữ
    // job_id thật để thăm dò/đọc đối chiếu vẫn dùng được, nhưng nếu chưa có trạng thái đầu ra thì xử lý như chưa hoàn tất (tắt reader).
    return {
      ...sharedDocFields,
      job_id: activeJobId,
      active_job_id: activeJobId,
      library_only: false,
      status: "",
      title: document.title || document.source_filename || "",
      display_name: document.title || document.source_filename || "",
      source_file_name: document.source_filename || "",
      page_count: document.page_count || 0,
      cover_url: firstUrl(document.cover_url),
      thumbnail_url: firstUrl(document.thumbnail_url),
      updated_at: document.updated_at || "",
    };
  }

  // Trạng thái thư viện (chưa dịch): job_id tổng hợp cho phép đi qua engine khóa theo job_id; đánh dấu library_only.
  return {
    ...sharedDocFields,
    job_id: syntheticLibraryJobId(documentId),
    active_job_id: "",
    library_only: true,
    status: "",
    title: document.title || document.source_filename || "",
    display_name: document.title || document.source_filename || "",
    source_file_name: document.source_filename || "",
    page_count: document.page_count || 0,
    cover_url: firstUrl(document.cover_url),
    thumbnail_url: firstUrl(document.thumbnail_url),
    updated_at: document.updated_at || "",
  };
}
