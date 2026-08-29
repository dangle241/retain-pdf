import test from "node:test";
import assert from "node:assert/strict";
import {
  shapeDocumentCardItem,
  syntheticLibraryJobId,
  isLibraryOnlyItem,
  LIBRARY_ONLY_JOB_PREFIX,
} from "../src/js/features/documents-library/document-card-item.js";
import { collectDocumentLibraryPage } from "../src/js/features/documents-library/document-library-source.js";

// ===== shapeDocumentCardItem: Ba trạng thái ánh xạ tài liệu =====

test("Tài liệu đã dịch: hợp nhất live state library/books, giữ job_id thật và danh tính tài liệu", () => {
  const document = {
    document_id: "docA",
    title: "Tính chọn lọc liên hợp",
    source_filename: "a.pdf",
    page_count: 10,
    active_job_id: "20260601-a",
    reading_status: "reading",
    tags: ["Hóa học"],
    source_pdf_url: "/api/v1/documents/docA/source.pdf",
    cover_url: "/api/v1/documents/docA/cover",
    updated_at: "2026-06-01T12:00:00Z",
  };
  const book = {
    id: "20260601-a",
    job_id: "20260601-a",
    title: "a.pdf",
    status: "succeeded",
    stage: "finished",
    progress: { current: 10, total: 10, percent: 100, unit: "none" },
    cover_url: "/api/v1/library/books/20260601-a/cover",
    page_count: 10,
    updated_at: "2026-06-01T12:00:00Z",
  };
  const item = shapeDocumentCardItem(document, book);
  assert.equal(item.library_only, false);
  assert.equal(item.job_id, "20260601-a", "Giữ job_id thật → có thể dùng polling/đọc đối chiếu");
  assert.equal(item.document_id, "docA");
  assert.equal(item.status, "succeeded");
  assert.equal(item.reading_status, "reading");
  assert.deepEqual(item.tags, ["Hóa học"]);
  assert.equal(item.source_pdf_url, "/api/v1/documents/docA/source.pdf");
  // book có cover → dùng cover của book (khớp với lưới hiện tại)
  assert.equal(item.cover_url, "/api/v1/library/books/20260601-a/cover");
});

test("Đã dịch nhưng book thiếu cover: cover_url fallback về cấp tài liệu", () => {
  const item = shapeDocumentCardItem(
    { document_id: "docA", active_job_id: "j1", cover_url: "/api/v1/documents/docA/cover" },
    { job_id: "j1", status: "running", progress: {} },
  );
  assert.equal(item.cover_url, "/api/v1/documents/docA/cover");
});

test("Tài liệu trong kho (không có active_job_id): tổng hợp job_id + đánh dấu library_only", () => {
  const item = shapeDocumentCardItem({
    document_id: "docRef",
    title: "Sách công cụ",
    source_filename: "ref.pdf",
    page_count: 42,
    active_job_id: null,
    reading_status: "unread",
    tags: ["Sách công cụ"],
    source_pdf_url: "/api/v1/documents/docRef/source.pdf",
    cover_url: "/api/v1/documents/docRef/cover",
    updated_at: "2026-06-10T09:00:00Z",
  }, null);
  assert.equal(item.library_only, true);
  assert.equal(item.job_id, `${LIBRARY_ONLY_JOB_PREFIX}docRef`);
  assert.equal(item.job_id, syntheticLibraryJobId("docRef"));
  assert.ok(isLibraryOnlyItem(item));
  assert.equal(item.active_job_id, "");
  assert.equal(item.status, "");
  assert.equal(item.title, "Sách công cụ");
  assert.equal(item.cover_url, "/api/v1/documents/docRef/cover");
  assert.equal(item.source_pdf_url, "/api/v1/documents/docRef/source.pdf");
});

test("Chuỗi rỗng active_job_id cũng xử lý như tài liệu trong kho", () => {
  const item = shapeDocumentCardItem({ document_id: "d", active_job_id: "" }, null);
  assert.equal(item.library_only, true);
  assert.equal(item.job_id, syntheticLibraryJobId("d"));
});

test("Có active_job_id nhưng book thiếu: giữ job_id thật, không phải kho, trạng thái trống", () => {
  const item = shapeDocumentCardItem(
    { document_id: "d", active_job_id: "j-missing", title: "x", page_count: 3 },
    null,
  );
  assert.equal(item.library_only, false);
  assert.equal(item.job_id, "j-missing");
  assert.equal(item.status, "");
});

// ===== collectDocumentLibraryPage: Phân trang + hợp nhất + loại trùng lặp + tìm kiếm =====

function makeFetchers({ documents, total, books }) {
  const calls = { documentQuery: null, bookJobIds: null };
  const fetchDocumentList = async (_prefix, params) => {
    calls.documentQuery = params;
    const offset = params.offset || 0;
    const limit = params.limit || documents.length;
    return { documents: documents.slice(offset, offset + limit), total, limit, offset };
  };
  const fetchLibraryBookList = async (_prefix, { jobIds = [] } = {}) => {
    calls.bookJobIds = jobIds;
    const wanted = new Set(jobIds);
    return { items: books.filter((b) => wanted.has(b.job_id)) };
  };
  return { fetchDocumentList, fetchLibraryBookList, calls };
}

test("Tích hợp một trang: đã dịch hợp nhất book, kho dùng id tổng hợp, hasMore quyết định bởi total", async () => {
  const documents = [
    { document_id: "d1", active_job_id: "j1", title: "Đã dịch một", page_count: 5 },
    { document_id: "d2", active_job_id: null, title: "Kho hai", page_count: 8 },
    { document_id: "d3", active_job_id: "j3", title: "Đã dịch ba", page_count: 9 },
  ];
  const books = [
    { job_id: "j1", status: "succeeded", progress: { percent: 100 } },
    { job_id: "j3", status: "running", progress: { percent: 40 } },
  ];
  const { fetchDocumentList, fetchLibraryBookList, calls } = makeFetchers({ documents, total: 5, books });

  const page = await collectDocumentLibraryPage({
    fetchDocumentList,
    fetchLibraryBookList,
    apiPrefix: "/api/v1",
    startOffset: 0,
    pageSize: 3,
    existingJobIds: new Set(),
    query: "",
  });

  assert.equal(page.collected.length, 3);
  assert.deepEqual(calls.bookJobIds, ["j1", "j3"], "Chỉ lấy book cho tài liệu có active_job_id");
  assert.equal(page.collected[0].status, "succeeded");
  assert.equal(page.collected[1].library_only, true);
  assert.equal(page.collected[1].job_id, syntheticLibraryJobId("d2"));
  assert.equal(page.collected[2].status, "running");
  assert.equal(page.hasMore, true, "3/5 → còn thêm");
  assert.equal(page.nextOffset, 3);
});

test("Loại trùng lặp xuyên trang: existingJobIds khớp (bao gồm id tổng hợp) không thu thập trùng", async () => {
  const documents = [
    { document_id: "d1", active_job_id: "j1", title: "a" },
    { document_id: "d2", active_job_id: null, title: "b" },
  ];
  const { fetchDocumentList, fetchLibraryBookList } = makeFetchers({ documents, total: 2, books: [{ job_id: "j1", status: "succeeded" }] });
  const page = await collectDocumentLibraryPage({
    fetchDocumentList,
    fetchLibraryBookList,
    apiPrefix: "/api/v1",
    startOffset: 0,
    pageSize: 10,
    existingJobIds: new Set(["j1", syntheticLibraryJobId("d2")]),
    query: "",
  });
  assert.equal(page.collected.length, 0, "Cả hai đều đã trong tập hợp hiện có");
  assert.equal(page.hasMore, false);
});

test("Tìm kiếm: lọc client theo tiêu đề, hasMore tắt", async () => {
  const documents = [
    { document_id: "d1", active_job_id: null, title: "Giới thiệu hóa học lượng tử" },
    { document_id: "d2", active_job_id: null, title: "Cơ bản học máy" },
    { document_id: "d3", active_job_id: null, source_filename: "quantum-notes.pdf" },
  ];
  const { fetchDocumentList, fetchLibraryBookList, calls } = makeFetchers({ documents, total: 3, books: [] });
  const page = await collectDocumentLibraryPage({
    fetchDocumentList,
    fetchLibraryBookList,
    apiPrefix: "/api/v1",
    startOffset: 0,
    pageSize: 2,
    existingJobIds: new Set(),
    query: "lượng tử",
  });
  assert.equal(page.collected.length, 1);
  assert.equal(page.collected[0].document_id, "d1");
  assert.equal(page.hasMore, false, "Trạng thái tìm kiếm tắt, ngừng phân trang");
  assert.ok((calls.documentQuery.limit || 0) >= 200, "Tìm kiếm lúc này kéo thêm một lô");
});
