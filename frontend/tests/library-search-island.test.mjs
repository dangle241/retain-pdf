import test from "node:test";
import assert from "node:assert/strict";
import {
  READING_STATUS_META,
  filterDocuments,
  highlightSegments,
  nextReadingStatus,
} from "../src/js/islands/library-search/view-model.js";

test("highlightSegments tách từ khóa được bọc bởi [ ] thành các đoạn highlight", () => {
  assert.deepEqual(highlightSegments("…đã khảo sát [quang phổ] trong chuỗi phản ứng [trao đổi]…"), [
    { text: "…đã khảo sát ", hit: false },
    { text: "quang phổ", hit: true },
    { text: " trong chuỗi phản ứng ", hit: false },
    { text: "trao đổi", hit: true },
    { text: "…", hit: false },
  ]);
  assert.deepEqual(highlightSegments("Không có kết quả"), [{ text: "Không có kết quả", hit: false }]);
  assert.deepEqual(highlightSegments(""), []);
});

test("nextReadingStatus tuần hoàn theo Chưa đọc → Đang đọc → Đã đọc xong", () => {
  assert.equal(nextReadingStatus("unread"), "reading");
  assert.equal(nextReadingStatus("reading"), "done");
  assert.equal(nextReadingStatus("done"), "unread");
  assert.equal(nextReadingStatus("bogus"), "unread");
  assert.deepEqual(Object.keys(READING_STATUS_META), ["unread", "reading", "done"]);
});

test("filterDocuments khớp theo tiêu đề/tên file/tag và chồng lớp lọc trạng thái", () => {
  const documents = [
    { document_id: "a", title: "Phân tích quang phổ", source_filename: "spec.pdf", tags: [], reading_status: "reading" },
    { document_id: "b", title: "Attention", source_filename: "attn.pdf", tags: ["Học máy"], reading_status: "done" },
    { document_id: "c", title: "Scaling", source_filename: "scaling.pdf", tags: [], reading_status: "unread" },
  ];
  assert.deepEqual(filterDocuments(documents, { query: "quang phổ" }).map((d) => d.document_id), ["a"]);
  assert.deepEqual(filterDocuments(documents, { query: "Học máy" }).map((d) => d.document_id), ["b"]);
  assert.deepEqual(filterDocuments(documents, { query: "pdf" }).map((d) => d.document_id), ["a", "b", "c"]);
  assert.deepEqual(filterDocuments(documents, { query: "pdf", readingStatus: "done" }).map((d) => d.document_id), ["b"]);
  assert.deepEqual(filterDocuments(documents, {}).length, 3);
});
