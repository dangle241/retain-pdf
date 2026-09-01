import test from "node:test";
import assert from "node:assert/strict";
import { resolveReaderAnchor } from "../src/js/reader/page-config.js";
import { buildReaderPageUrl } from "../src/js/job/action-model.js";
import { pageNumberFromUrlAnchor } from "../src/pages/reader/hooks/use-url-anchor-jump.ts";

test("resolveReaderAnchor parses page_idx/block_id, returns null if both missing", () => {
  assert.deepEqual(resolveReaderAnchor({ search: "?job_id=j&page_idx=3&block_id=b-9" }), {
    pageIdx: 3,
    blockId: "b-9",
  });
  assert.deepEqual(resolveReaderAnchor({ search: "?page_idx=0" }), { pageIdx: 0, blockId: "" });
  assert.deepEqual(resolveReaderAnchor({ search: "?block_id=b-1" }), { pageIdx: null, blockId: "b-1" });
  assert.equal(resolveReaderAnchor({ search: "?job_id=j" }), null);
  assert.equal(resolveReaderAnchor({ search: "?page_idx=abc" }), null);
});

test("buildReaderPageUrl passes anchor parameters through, page_idx=0 not lost", () => {
  const url = new URL(buildReaderPageUrl("job-1", { pageIdx: 0, blockId: "b-intro-3" }));
  assert.equal(url.searchParams.get("job_id"), "job-1");
  assert.equal(url.searchParams.get("page_idx"), "0");
  assert.equal(url.searchParams.get("block_id"), "b-intro-3");
  const plain = new URL(buildReaderPageUrl("job-1"));
  assert.equal(plain.searchParams.get("page_idx"), null);
  assert.equal(plain.searchParams.get("block_id"), null);
});

test("pageNumberFromUrlAnchor: 0-based page_idx → 1-based page number", () => {
  assert.equal(pageNumberFromUrlAnchor({ pageIdx: 0, blockId: "" }), 1);
  assert.equal(pageNumberFromUrlAnchor({ pageIdx: 3, blockId: "b-9" }), 4);
  assert.equal(pageNumberFromUrlAnchor({ pageIdx: null, blockId: "b-1" }), null);
  assert.equal(pageNumberFromUrlAnchor(null), null);
  assert.equal(pageNumberFromUrlAnchor({ pageIdx: -1, blockId: "" }), null);
});
