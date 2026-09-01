import test from "node:test";
import assert from "node:assert/strict";
import {
  READING_STATUS_META,
  filterDocuments,
  highlightSegments,
  nextReadingStatus,
} from "../src/js/islands/library-search/view-model.js";

test("highlightSegments splits hit words wrapped in [ ] into highlight segments", () => {
assert.deepEqual(highlightSegments("â¦examined [spectrum] series [exchange] reactionâ¦"), [
    { text: "…考察了", hit: false },
    { text: "光谱", hit: true },
    { text: "系列中的", hit: false },
    { text: "交换", hit: true },
    { text: "反应…", hit: false },
  ]);
  assert.deepEqual(highlightSegments("无命中"), [{ text: "无命中", hit: false }]);
  assert.deepEqual(highlightSegments(""), []);
});

test("nextReadingStatus cycles through unread â reading â done", () => {
  assert.equal(nextReadingStatus("unread"), "reading");
  assert.equal(nextReadingStatus("reading"), "done");
  assert.equal(nextReadingStatus("done"), "unread");
  assert.equal(nextReadingStatus("bogus"), "unread");
  assert.deepEqual(Object.keys(READING_STATUS_META), ["unread", "reading", "done"]);
});

test("filterDocuments matches by title/filename/tag and overlays status filter", () => {
  const documents = [
    { document_id: "a", title: "光谱分析", source_filename: "spec.pdf", tags: [], reading_status: "reading" },
    { document_id: "b", title: "Attention", source_filename: "attn.pdf", tags: ["机器学习"], reading_status: "done" },
    { document_id: "c", title: "Scaling", source_filename: "scaling.pdf", tags: [], reading_status: "unread" },
  ];
  assert.deepEqual(filterDocuments(documents, { query: "光谱" }).map((d) => d.document_id), ["a"]);
  assert.deepEqual(filterDocuments(documents, { query: "机器学习" }).map((d) => d.document_id), ["b"]);
  assert.deepEqual(filterDocuments(documents, { query: "pdf" }).map((d) => d.document_id), ["a", "b", "c"]);
  assert.deepEqual(filterDocuments(documents, { query: "pdf", readingStatus: "done" }).map((d) => d.document_id), ["b"]);
  assert.deepEqual(filterDocuments(documents, {}).length, 3);
});
