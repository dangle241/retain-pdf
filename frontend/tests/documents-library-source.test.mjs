import test from "node:test";
import assert from "node:assert/strict";
import {
  shapeDocumentCardItem,
  syntheticLibraryJobId,
  isLibraryOnlyItem,
  LIBRARY_ONLY_JOB_PREFIX,
} from "../src/js/features/documents-library/document-card-item.js";
import { collectDocumentLibraryPage } from "../src/js/features/documents-library/document-library-source.js";

// ===== shapeDocumentCardItem: three document state mappings =====

test("Translated document: merge library/books active state, preserve real job_id and document identity", () => {
  const document = {
    document_id: "docA",
title: "Conjugate Selectivity",
    source_filename: "a.pdf",
    page_count: 10,
    active_job_id: "20260601-a",
    reading_status: "reading",
tags: ["Chemistry"],
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
assert.equal(item.job_id, "20260601-a", "Preserve real job_id â polling/comparative reading available");
  assert.equal(item.document_id, "docA");
  assert.equal(item.status, "succeeded");
  assert.equal(item.reading_status, "reading");
assert.deepEqual(item.tags, ["Chemistry"]);
  assert.equal(item.source_pdf_url, "/api/v1/documents/docA/source.pdf");
// book has cover â use book's (consistent with current grid visuals)
  assert.equal(item.cover_url, "/api/v1/library/books/20260601-a/cover");
});

test("Translated but book missing cover: fallback to document-level cover_url", () => {
  const item = shapeDocumentCardItem(
    { document_id: "docA", active_job_id: "j1", cover_url: "/api/v1/documents/docA/cover" },
    { job_id: "j1", status: "running", progress: {} },
  );
  assert.equal(item.cover_url, "/api/v1/documents/docA/cover");
});

test("Library document (no active_job_id): synthesize job_id + library_only flag", () => {
  const item = shapeDocumentCardItem({
    document_id: "docRef",
title: "Reference Book",
    source_filename: "ref.pdf",
    page_count: 42,
    active_job_id: null,
    reading_status: "unread",
tags: ["Reference Book"],
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
assert.equal(item.title, "Reference Book");
  assert.equal(item.cover_url, "/api/v1/documents/docRef/cover");
  assert.equal(item.source_pdf_url, "/api/v1/documents/docRef/source.pdf");
});

test("Empty string active_job_id also treated as library", () => {
  const item = shapeDocumentCardItem({ document_id: "d", active_job_id: "" }, null);
  assert.equal(item.library_only, true);
  assert.equal(item.job_id, syntheticLibraryJobId("d"));
});

test("Has active_job_id but book missing: preserve real job_id, not library, status empty", () => {
  const item = shapeDocumentCardItem(
    { document_id: "d", active_job_id: "j-missing", title: "x", page_count: 3 },
    null,
  );
  assert.equal(item.library_only, false);
  assert.equal(item.job_id, "j-missing");
  assert.equal(item.status, "");
});

// ===== collectDocumentLibraryPage: pagination + merge + deduplication + search =====

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

test("Integrate one page: merge translated with book, library uses synthetic id, hasMore determined by total", async () => {
  const documents = [
    { document_id: "d1", active_job_id: "j1", title: "已翻译一", page_count: 5 },
    { document_id: "d2", active_job_id: null, title: "馆藏二", page_count: 8 },
    { document_id: "d3", active_job_id: "j3", title: "已翻译三", page_count: 9 },
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
assert.deepEqual(calls.bookJobIds, ["j1", "j3"], "Fetch book only for documents with active_job_id");
  assert.equal(page.collected[0].status, "succeeded");
  assert.equal(page.collected[1].library_only, true);
  assert.equal(page.collected[1].job_id, syntheticLibraryJobId("d2"));
  assert.equal(page.collected[2].status, "running");
assert.equal(page.hasMore, true, "3/5 â more available");
  assert.equal(page.nextOffset, 3);
});

test("Cross-page deduplication: items hitting existingJobIds (including synthetic ids) not collected again", async () => {
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
assert.equal(page.collected.length, 0, "Both items already in existing set");
  assert.equal(page.hasMore, false);
});

test("Search: client-side filter by title, hasMore disabled", async () => {
  const documents = [
    { document_id: "d1", active_job_id: null, title: "量子化学导论" },
    { document_id: "d2", active_job_id: null, title: "机器学习基础" },
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
query: "Quantum",
  });
  assert.equal(page.collected.length, 1);
  assert.equal(page.collected[0].document_id, "d1");
assert.equal(page.hasMore, false, "Disable further pagination in search state");
assert.ok((calls.documentQuery.limit || 0) >= 200, "Fetch larger batch during search");
});
