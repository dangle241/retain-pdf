import test from "node:test";
import assert from "node:assert/strict";

import { normalizeBlockKey } from "../src/js/reader/region-interactions.js";

test("normalizeBlockKey Normalize two zero-padding formats to same key.", () => {
// regions itemId (3 digits) and server block_id (4 digits) must be equal
  assert.equal(normalizeBlockKey("p001-b002"), "p1-b2");
  assert.equal(normalizeBlockKey("p001-b0002"), "p1-b2");
  assert.equal(normalizeBlockKey("p012-b0034"), "p12-b34");
  assert.equal(normalizeBlockKey("P001-B0002"), "p1-b2");
});

test("normalizeBlockKey Non-standard ID return as is", () => {
  assert.equal(normalizeBlockKey("__cg__:cg-001"), "__cg__:cg-001");
  assert.equal(normalizeBlockKey(""), "");
  assert.equal(normalizeBlockKey(null), "");
});
