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

// ===== documents:Shape and semantics(Align with backend integration docs.) =====

test("mock document list supports reading_status and tag filtering", () => {
  const all = getMockDocumentList();
  assert.ok(all.documents.length >= 3);
  for (const doc of all.documents) {
    assert.ok(doc.document_id);
// Documentation Center model: active_job_id Nullable (collection state, store untranslated only), no longer a hard invariant.
    assert.ok(["unread", "reading", "done"].includes(doc.reading_status));
    assert.ok(Array.isArray(doc.tags));
// API Layer assigns three media items per document. URL (mirror backend with_document_media_urls).
assert.ok(doc.source_pdf_url, "source_pdf_url allows reading original text for archival documents");
    assert.ok(doc.cover_url);
    assert.ok(doc.thumbnail_url);
  }
// Translated and archival docs. (no active_job_id).
assert.ok(all.documents.some((doc) => `${doc.active_job_id || ""}`.trim()), "translated documents exist");
  assert.ok(
    all.documents.some((doc) => !`${doc.active_job_id || ""}`.trim()),
"archival documents exist (no active_job_id)",
  );
  const reading = getMockDocumentList({ readingStatus: "reading" });
  assert.ok(reading.documents.every((doc) => doc.reading_status === "reading"));
  const tagged = getMockDocumentList({ tag: "化学" });
  assert.ok(tagged.documents.length >= 1);
assert.ok(tagged.documents.every((doc) => doc.tags.includes("Chemistry")));
});

test("translateMockDocument: assign active_job_id to archival document and return submission view", () => {
  const before = getMockDocumentList().documents.find((doc) => !`${doc.active_job_id || ""}`.trim());
assert.ok(before, "at least one archival document");
  const submission = translateMockDocument(before.document_id);
  assert.equal(submission.document_id, before.document_id);
assert.ok(submission.job_id, "returns job_id");
  assert.ok(["queued", "running", "pending"].includes(submission.status));
  const after = getMockDocument(before.document_id);
assert.equal(after.active_job_id, submission.job_id, "archival document assigned active_job_id");
  // Idempotency guard:Throw error if re-initiated during translation.
  assert.throws(() => translateMockDocument(before.document_id), /409/);
});

test("deleteMockDocument: disappears from list after deletion, throws 404 on retrieval", () => {
  // Use second archive doc(Other test Leave untouched,Avoid cross-case state crosstalk)。
  const target = "doc-ref-9b7e04";
  assert.ok(getMockDocumentList({ limit: 999 }).documents.some((doc) => doc.document_id === target));
  const result = deleteMockDocument(target);
  assert.equal(result.deleted, true);
  assert.equal(result.document_id, target);
  assert.equal(
    getMockDocumentList({ limit: 999 }).documents.some((doc) => doc.document_id === target),
    false,
"not in list after deletion",
  );
  assert.throws(() => getMockDocument(target), /404/);
assert.throws(() => deleteMockDocument(target), /404/, "throws 404 on second deletion");
});

test("deleteMockDocument: throws 409 when referenced by favorites", () => {
// MOCK_DOCUMENT_ID Two entries mock favorites (fav-001/fav-002) → Deletion must be blocked.
  assert.throws(() => deleteMockDocument(MOCK_DOCUMENT_ID), /409/);
});

test("PATCH document: reading_status validation and tags full replacement semantics", () => {
  assert.throws(() => patchMockDocument(MOCK_DOCUMENT_ID, { reading_status: "archived" }), /400/);
  const updated = patchMockDocument(MOCK_DOCUMENT_ID, { tags: ["新标签"] });
assert.deepEqual(updated.tags, ["new tag"]);
  const cleared = patchMockDocument(MOCK_DOCUMENT_ID, { tags: [] });
assert.deepEqual(cleared.tags, [], "passing [] clears tags");
  patchMockDocument(MOCK_DOCUMENT_ID, { reading_status: "done" });
  assert.equal(getMockDocument(MOCK_DOCUMENT_ID).reading_status, "done");
});

// ===== favorites:Required validationactive_job_id Anchoring, sorting =====

test("create favorite: required field validation and job_id auto-anchoring to active_job_id", () => {
  assert.throws(() => createMockFavorite({ document_id: MOCK_DOCUMENT_ID }), /400/);
  const favorite = createMockFavorite({
    document_id: MOCK_DOCUMENT_ID,
    page_idx: 5,
    block_id: "b-test-1",
quote_text: "test quote snapshot",
  });
assert.equal(favorite.job_id, getMockDocument(MOCK_DOCUMENT_ID).active_job_id, "anchor to document active_job_id when job_id is not provided");
assert.equal(favorite.kind, "sentence", "kind defaults to sentence");
  deleteMockFavorite(favorite.favorite_id);
});

test("favorites list: sort by page number when filtering by document", () => {
  const byDocument = getMockFavorites({ documentId: MOCK_DOCUMENT_ID });
  const pages = byDocument.favorites.map((item) => item.page_idx);
  assert.deepEqual(pages, [...pages].sort((a, b) => a - b));
  for (const item of byDocument.favorites) {
    // Anchor quaternion set complete.,job_id + page + block Reader positioning coordinates
    assert.ok(item.document_id && item.job_id && item.block_id);
    assert.equal(typeof item.page_idx, "number");
assert.ok(item.quote_text, "quote_text snapshot must exist");
  }
});

// ===== search:Hit shape, highlight wrapper =====

test("search hit with anchor quadruple, hit words wrapped in [ ]", () => {
const { hits } = getMockSearchHits("spectrum");
  assert.ok(hits.length > 0);
  for (const hit of hits) {
    assert.ok(hit.document_id && hit.job_id && hit.block_id);
    assert.equal(typeof hit.page_idx, "number");
assert.match(hit.source_snippet, /\[spectrum\]/);
  }
  assert.deepEqual(getMockSearchHits("").hits, []);
});

// ===== Deletion protection: 409 Render as friendly copy, never auto force =====

test("delete job referenced by favorites: show favorite count prompt instead of auto-force delete", async () => {
assert.ok(countMockFavoritesByJob(MOCK_JOB_ID) > 0, "precondition: mock job has favorite references");
  const errors = [];
  const deleteCalls = [];
  const actions = createRecentJobActions({
    apiPrefix: "/api/v1",
    navigationPort: { openJob() {}, openReader() {} },
    deleteLibraryBook: async (_prefix, jobId, options = {}) => {
      deleteCalls.push([jobId, options]);
const conflict = new Error(This job is referenced by 3 favorites (409));
      conflict.status = 409;
      throw conflict;
    },
    renderCurrentRecentJobs() {},
    renderRecentJobsEmpty() {},
    renderRecentJobsError: (message) => errors.push(message),
    statePort: {
      removeJobFamily() {
throw new Error("should not continue deleting local entry on 409");
      },
      getSnapshot: () => ({ items: [] }),
    },
  });

  await actions.deleteJob(MOCK_JOB_ID);

assert.equal(deleteCalls.length, 1, "never auto-force retry");
  assert.deepEqual(deleteCalls[0][1], {});
  assert.equal(errors.length, 1);
assert.match(errors[0], /This document has 3 favorites, please delete the favorites first/);
});

test("direct document lookup by job_id: active_job_id hit + historical run resolves to same document", async () => {
// isMockMode relies on window.location.search's ?mock=, configure first, then dynamic import api layer
  globalThis.window = { location: { search: "?mock=succeeded", protocol: "http:", hostname: "127.0.0.1" } };
  const { fetchDocumentByJobId } = await import("../src/js/api/documents.js");
// active_job_id hit
  const active = await fetchDocumentByJobId("/api/v1", MOCK_JOB_ID);
  assert.equal(active?.document_id, MOCK_DOCUMENT_ID);
// historical run (non-active) — Correct. #1 to be solved: reverse lookup list omits entries, direct lookup hits.
  const historical = await fetchDocumentByJobId("/api/v1", "mock-job-20260101-old");
assert.equal(historical?.document_id, MOCK_DOCUMENT_ID, "historical run resolves to belonging document");
  // Not part of any document → null
  assert.equal(await fetchDocumentByJobId("/api/v1", "job-nonexistent"), null);
  assert.equal(await fetchDocumentByJobId("/api/v1", ""), null);
});
