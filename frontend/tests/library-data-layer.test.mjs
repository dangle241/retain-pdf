import test from "node:test";
import assert from "node:assert/strict";
import {
  MOCK_DOCUMENT_ID,
  createMockFavorite,
  deleteMockFavorite,
  getMockDocument,
  getMockDocumentList,
  getMockFavorites,
  getMockSearchHits,
  countMockFavoritesByJob,
  patchMockDocument,
  translateMockDocument,
  deleteMockDocument,
} from "../src/js/mock/documents.js";
import { MOCK_JOB_ID } from "../src/js/mock/constants.js";
import { createRecentJobActions } from "../src/js/features/recent-jobs/actions.js";

// ===== documents: hình dạng và ngữ nghĩa (căn chỉnh với mô tả tích hợp backend) =====

test("Danh sách tài liệu mock hỗ trợ lọc theo reading_status và tag", () => {
  const all = getMockDocumentList();
  assert.ok(all.documents.length >= 3);
  for (const doc of all.documents) {
    assert.ok(doc.document_id);
    // Mô hình trung tâm tài liệu: active_job_id có thể null (trạng thái lưu trữ, chỉ nhập kho chưa dịch), không còn là bất biến cứng.
    assert.ok(["unread", "reading", "done"].includes(doc.reading_status));
    assert.ok(Array.isArray(doc.tags));
    // Tầng API điền ba URL media cho mỗi tài liệu (gương backend with_document_media_urls).
    assert.ok(doc.source_pdf_url, "source_pdf_url cho phép tài liệu thư viện đọc bản gốc");
    assert.ok(doc.cover_url);
    assert.ok(doc.thumbnail_url);
  }
  // Có cả tài liệu đã dịch và tài liệu lưu trữ (không có active_job_id).
  assert.ok(all.documents.some((doc) => `${doc.active_job_id || ""}`.trim()), "Tồn tại tài liệu đã dịch");
  assert.ok(
    all.documents.some((doc) => !`${doc.active_job_id || ""}`.trim()),
    "Tồn tại tài liệu trạng thái thư viện (không có active_job_id)",
  );
  const reading = getMockDocumentList({ readingStatus: "reading" });
  assert.ok(reading.documents.every((doc) => doc.reading_status === "reading"));
  const tagged = getMockDocumentList({ tag: "Hóa học" });
  assert.ok(tagged.documents.length >= 1);
  assert.ok(tagged.documents.every((doc) => doc.tags.includes("Hóa học")));
});

test("translateMockDocument: gắn active_job_id cho tài liệu thư viện và trả về view submit", () => {
  const before = getMockDocumentList().documents.find((doc) => !`${doc.active_job_id || ""}`.trim());
  assert.ok(before, "Ít nhất một tài liệu thư viện");
  const submission = translateMockDocument(before.document_id);
  assert.equal(submission.document_id, before.document_id);
  assert.ok(submission.job_id, "Trả về job_id");
  assert.ok(["queued", "running", "pending"].includes(submission.status));
  const after = getMockDocument(before.document_id);
  assert.equal(after.active_job_id, submission.job_id, "Tài liệu thư viện được gắn active_job_id");
  assert.throws(() => translateMockDocument(before.document_id), /409/, "Bảo vệ lũy đẳng: đang trong quy trình dịch, gọi lại phải báo lỗi.");
});

test("deleteMockDocument: sau khi xóa biến mất khỏi danh sách, lấy lại ném 404", () => {
  // Dùng tài liệu lưu trữ thứ hai (các test khác không đụng tới, tránh nhiễu trạng thái giữa các test).
  const target = "doc-ref-9b7e04";
  assert.ok(getMockDocumentList({ limit: 999 }).documents.some((doc) => doc.document_id === target));
  const result = deleteMockDocument(target);
  assert.equal(result.deleted, true);
  assert.equal(result.document_id, target);
  assert.equal(
    getMockDocumentList({ limit: 999 }).documents.some((doc) => doc.document_id === target),
    false,
    "Sau khi xóa không còn trong danh sách",
  );
  assert.throws(() => getMockDocument(target), /404/);
  assert.throws(() => deleteMockDocument(target), /404/, "Xóa lần nữa báo 404");
});

test("deleteMockDocument: báo 409 khi được tham chiếu bởi收藏", () => {
  // MOCK_DOCUMENT_ID có hai mục收藏 mock (fav-001/fav-002) → xóa sẽ bị chặn.
  assert.throws(() => deleteMockDocument(MOCK_DOCUMENT_ID), /409/);
});

test("PATCH tài liệu: kiểm tra reading_status và ngữ nghĩa thay thế toàn bộ tags", () => {
  assert.throws(() => patchMockDocument(MOCK_DOCUMENT_ID, { reading_status: "archived" }), /400/);
  const updated = patchMockDocument(MOCK_DOCUMENT_ID, { tags: ["Tag mới"] });
  assert.deepEqual(updated.tags, ["Tag mới"]);
  const cleared = patchMockDocument(MOCK_DOCUMENT_ID, { tags: [] });
  assert.deepEqual(cleared.tags, [], "Truyền [] tức là làm trống");
  patchMockDocument(MOCK_DOCUMENT_ID, { reading_status: "done" });
  assert.equal(getMockDocument(MOCK_DOCUMENT_ID).reading_status, "done");
});

// ===== favorites: kiểm tra trường bắt buộc, neo active_job_id, sắp xếp =====

test("Tạo收藏: kiểm tra trường bắt buộc và job_id tự động neo vào active_job_id", () => {
  assert.throws(() => createMockFavorite({ document_id: MOCK_DOCUMENT_ID }), /400/);
  const favorite = createMockFavorite({
    document_id: MOCK_DOCUMENT_ID,
    page_idx: 5,
    block_id: "b-test-1",
    quote_text: "Ảnh chụp trích dẫn kiểm thử",
  });
  assert.equal(favorite.job_id, getMockDocument(MOCK_DOCUMENT_ID).active_job_id, "Khi không truyền job_id thì neo vào active_job_id của tài liệu");
  assert.equal(favorite.kind, "sentence", "kind mặc định là sentence");
  deleteMockFavorite(favorite.favorite_id);
});

test("Danh sách收藏: sắp xếp theo số trang khi lọc theo tài liệu", () => {
  const byDocument = getMockFavorites({ documentId: MOCK_DOCUMENT_ID });
  const pages = byDocument.favorites.map((item) => item.page_idx);
  assert.deepEqual(pages, [...pages].sort((a, b) => a - b));
  for (const item of byDocument.favorites) {
    // Bộ tứ điểm neo đầy đủ: job_id + page + block chính là tọa độ định vị trong trình đọc
    assert.ok(item.document_id && item.job_id && item.block_id);
    assert.equal(typeof item.page_idx, "number");
    assert.ok(item.quote_text, "quote_text ảnh chụp trích dẫn phải tồn tại");
  }
});

// ===== search: hình dạng kết quả命中 và gói highlight =====

test("Kết quả tìm kiếm mang bộ tứ điểm neo, từ khóa được bọc bằng [ ]", () => {
  const { hits } = getMockSearchHits("quang phổ");
  assert.ok(hits.length > 0);
  for (const hit of hits) {
    assert.ok(hit.document_id && hit.job_id && hit.block_id);
    assert.equal(typeof hit.page_idx, "number");
    assert.match(hit.source_snippet, /\[quang phổ\]/);
  }
  assert.deepEqual(getMockSearchHits("").hits, []);
});

// =====Bảo vệ xóa: 409 hiển thị thành văn bản thân thiện, tuyệt đối không tự động ép buộc=====

test("Xóa job được tham chiếu bởi收藏: hiển thị提示 số lượng收藏 thay vì tự động ép xóa", async () => {
  assert.ok(countMockFavoritesByJob(MOCK_JOB_ID) > 0, "Tiền đề: mock job tồn tại tham chiếu收藏");
  const errors = [];
  const deleteCalls = [];
  const actions = createRecentJobActions({
    apiPrefix: "/api/v1",
    navigationPort: { openJob() {}, openReader() {} },
    deleteLibraryBook: async (_prefix, jobId, options = {}) => {
      deleteCalls.push([jobId, options]);
      const conflict = new Error(`Job này được 3收藏 tham chiếu (409)`);
      conflict.status = 409;
      throw conflict;
    },
    renderCurrentRecentJobs() {},
    renderRecentJobsEmpty() {},
    renderRecentJobsError: (message) => errors.push(message),
    statePort: {
      removeJobFamily() {
        throw new Error("Khi 409 không nên tiếp tục xóa mục cục bộ");
      },
      getSnapshot: () => ({ items: [] }),
    },
  });

  await actions.deleteJob(MOCK_JOB_ID);

  assert.equal(deleteCalls.length, 1, "Tuyệt đối không tự động ép retry");
  assert.deepEqual(deleteCalls[0][1], {});
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Tài liệu này có 3收藏, vui lòng xóa收藏 trước/);
});

test("Tra cứu tài liệu trực tiếp theo job_id: active_job_id khớp + lịch sử run cũng解析到 cùng tài liệu", async () => {
  // isMockMode dựa vào ?mock trong window.location.search, thiết lập rồi mới dynamic import tầng api
  globalThis.window = { location: { search: "?mock=succeeded", protocol: "http:", hostname: "127.0.0.1" } };
  const { fetchDocumentByJobId } = await import("../src/js/api/documents.js");
  // Hit active_job_id
  const active = await fetchDocumentByJobId("/api/v1", MOCK_JOB_ID);
  assert.equal(active?.document_id, MOCK_DOCUMENT_ID);
  // Lịch sử run (không phải active)——đây chính là vấn đề cần giải quyết ở #1: tra danh sách sẽ漏, tra trực tiếp trúng
  const historical = await fetchDocumentByJobId("/api/v1", "mock-job-20260101-old");
  assert.equal(historical?.document_id, MOCK_DOCUMENT_ID, "Lịch sử run解析到 tài liệu sở hữu");
  // Không thuộc về tài liệu nào → null
  assert.equal(await fetchDocumentByJobId("/api/v1", "job-nonexistent"), null);
  assert.equal(await fetchDocumentByJobId("/api/v1", ""), null);
});
