import test from "node:test";
import assert from "node:assert/strict";
import {
  createReaderServerFavoritesPort,
  dedupeServerFavorites,
  normalizeServerFavorite,
} from "../src/js/reader/server-favorites-port.js";
import { deleteFavorite } from "../src/js/api/favorites.js";

const API_FAVORITE = {
  favorite_id: "fav-1",
  document_id: "doc-1",
  job_id: "job-1",
  page_idx: 3,
  block_id: "b-3-7",
  kind: "sentence",
quote_text: "quote snapshot",
  translated_quote_text: "translated snapshot",
  note: "",
  created_at: "2026-07-01T08:00:00Z",
};

// ===== Normalization: API snake_case â Reader View Record =====

test("normalizeServerFavorite: API Favorites View History, page_idx remains 0-indexed", () => {
  const record = normalizeServerFavorite(API_FAVORITE);
  assert.deepEqual(record, {
    favoriteId: "fav-1",
    documentId: "doc-1",
    jobId: "job-1",
    pageIdx: 3,
    blockId: "b-3-7",
    kind: "sentence",
quoteText: "quote snapshot",
    translatedQuoteText: "translated snapshot",
    note: "",
    createdAt: "2026-07-01T08:00:00Z",
  });
});

test("normalizeServerFavorite: Discard if favorite_id/quote_text missing, invalid page_idx defaults to 0, kind defaults to sentence", () => {
  assert.equal(normalizeServerFavorite({ ...API_FAVORITE, favorite_id: "" }), null);
  assert.equal(normalizeServerFavorite({ ...API_FAVORITE, quote_text: "  " }), null);
  assert.equal(normalizeServerFavorite(null), null);
  const fallback = normalizeServerFavorite({ ...API_FAVORITE, page_idx: "abc", kind: "" });
  assert.equal(fallback.pageIdx, 0);
  assert.equal(fallback.kind, "sentence");
});

test("loadServerFavorites: Direct lookup of document_id by job_id and normalize, Dirty data filtered.", async () => {
  const loadCalls = [];
  const port = createReaderServerFavoritesPort({
    jobId: "job-1",
    apiPrefix: "/api/v1",
    documentByJobId: async (_apiPrefix, jobId) => (jobId === "job-1"
      ? { document_id: "doc-1", active_job_id: "job-1" }
      : null),
    loadFavorites: async (apiPrefix, options) => {
      loadCalls.push({ apiPrefix, options });
      return {
        favorites: [
          API_FAVORITE,
          { ...API_FAVORITE, favorite_id: "fav-bad", quote_text: "" },
        ],
      };
    },
  });
  const records = await port.loadServerFavorites();
  assert.deepEqual(loadCalls, [{ apiPrefix: "/api/v1", options: { documentId: "doc-1" } }]);
  assert.equal(records.length, 1);
  assert.equal(records[0].favoriteId, "fav-1");
  assert.equal(await port.resolveDocumentId(), "doc-1");
});

test("loadServerFavorites:document not found/On request failure, silently return empty array.", async () => {
// mock Pattern no longer short-circuits.: API layer has built-in mock branch, baseline and e2e depend on mock End-to-end usable
  const missingPort = createReaderServerFavoritesPort({
    jobId: "job-x",
    documentByJobId: async () => null,
    loadFavorites: async () => {
      throw new Error("should not be called");
    },
  });
  assert.deepEqual(await missingPort.loadServerFavorites(), []);

  const failingPort = createReaderServerFavoritesPort({
    jobId: "job-1",
    documentByJobId: async () => ({ document_id: "doc-1", active_job_id: "job-1" }),
    loadFavorites: async () => {
      throw new Error("network down");
    },
  });
  assert.deepEqual(await failingPort.loadServerFavorites(), []);
});

// ===== Deduplication: Local synced(serverFavoriteId) Prevent duplicate display of records in cloud zone. =====

test("dedupeServerFavorites: remove when favorite_id matches local serverFavoriteId", () => {
  const serverRecords = [
    normalizeServerFavorite(API_FAVORITE),
    normalizeServerFavorite({ ...API_FAVORITE, favorite_id: "fav-2", quote_text: "Another" }),
  ];
  const localItems = [
    { id: "local-1", serverFavoriteId: "fav-1" },
    { id: "local-2" },
  ];
  const visible = dedupeServerFavorites(serverRecords, localItems);
  assert.deepEqual(visible.map((item) => item.favoriteId), ["fav-2"]);
  assert.deepEqual(
    dedupeServerFavorites(serverRecords, []).map((item) => item.favoriteId),
    ["fav-1", "fav-2"],
  );
  assert.deepEqual(dedupeServerFavorites(null, null), []);
});

// ===== Deletion Flow: Port best-effort + API layer sends actual DELETE =====

test("removeServerFavorite: No.  I'll just output "Success". Success true, failure/empty id returns false", async () => {
  const deleteCalls = [];
  const port = createReaderServerFavoritesPort({
    jobId: "job-1",
    apiPrefix: "/api/v1",
    removeFavorite: async (apiPrefix, favoriteId) => {
      deleteCalls.push({ apiPrefix, favoriteId });
      return { deleted: true };
    },
  });
  assert.equal(await port.removeServerFavorite("fav-1"), true);
  assert.deepEqual(deleteCalls, [{ apiPrefix: "/api/v1", favoriteId: "fav-1" }]);
  assert.equal(await port.removeServerFavorite(""), false);

  const failingPort = createReaderServerFavoritesPort({
    jobId: "job-1",
    removeFavorite: async () => {
      throw new Error("500");
    },
  });
assert.equal(await failingPort.removeServerFavorite("fav-1"), false, "Do not throw on deletion failure., return false");
});

test("deleteFavorite API: send DELETE to /favorites/:favorite_id (mock fetch)", async () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.window = { location: { search: "", protocol: "http:", hostname: "127.0.0.1" } };
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () => ({ code: 0, data: { deleted: true }, message: "ok" }),
    };
  };
  try {
const result = await deleteFavorite("/api/v1", "fav ä¸­æ/id");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.method, "DELETE");
    assert.match(calls[0].url, /\/api\/v1\/favorites\/fav%20%E4%B8%AD%E6%96%87%2Fid$/);
    assert.deepEqual(result, { deleted: true });
    await assert.rejects(() => deleteFavorite("/api/v1", "   "), /favorite_id/);
  } finally {
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
  }
});
