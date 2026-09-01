import test from "node:test";
import assert from "node:assert/strict";
import {
  filterDocumentOptions,
  parseAtQuery,
} from "../src/pages/home/features/home-ask/document-picker.js";

test("parseAtQuery: Cursor at @query Deferred parsing", () => {
const text = "Summarize this for me @halogen";
  const caret = text.length;
  const parsed = parseAtQuery(text, caret);
  assert.deepEqual(parsed, { start: text.indexOf("@"), query: "halogen" });
});

test("parseAtQuery: Normal text does not trigger.", () => {
  assert.equal(parseAtQuery("hello world", 5), null);
  assert.equal(parseAtQuery("email@x.com", 11), null);
});

test("parseAtQuery: Start of Line @ Parsable", () => {
  assert.deepEqual(parseAtQuery("@doc", 4), { start: 0, query: "doc" });
});

test("filterDocumentOptions: Exclude selected & filter by title", () => {
  const options = [
    { kind: "document", id: "a", title: "Alpha paper" },
    { kind: "document", id: "b", title: "Beta notes" },
    { kind: "document", id: "c", title: "Gamma" },
  ];
  const filtered = filterDocumentOptions(options, "beta", ["document:a"]);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "b");
});

test("filterDocumentOptions: Matchable Collection", () => {
  const options = [
    { kind: "collection", id: "col-1", title: "量子化学", document_count: 4 },
    { kind: "document", id: "d1", title: "Other paper" },
  ];
const filtered = filterDocumentOptions(options, "Quantum", []);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].kind, "collection");
  assert.equal(filtered[0].id, "col-1");
});
