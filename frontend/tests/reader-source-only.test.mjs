import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveReaderDocumentId,
  resolveReaderJobId,
} from "../src/js/reader/page-config.js";
import { createReaderDialogConfigPort } from "../src/js/features/reader-dialog/config-port.js";

// Collection document "read original" (F4): when no job, only document_id, reader goes to read-only source document branch.

test("resolveReaderJobId: does not fall back to mock job when document_id is present", () => {
// Critical regression: in mock mode, resolveReaderJobId would fall back to mock job id —
// if the source document reader gets this id, it would mount the mock job translation, breaking the entire read-only chain.
  const jobId = resolveReaderJobId({
    search: "?document_id=doc-abc",
    isMock: () => true,
    mockJobId: () => "mock-job-1",
  });
assert.equal(jobId, "", "do not return mock job when document_id is present");
});

test("resolveReaderJobId: job_id takes precedence, mock fallback unchanged when no job_id/document_id", () => {
  assert.equal(
    resolveReaderJobId({ search: "?job_id=j1&document_id=doc-abc", isMock: () => true, mockJobId: () => "m" }),
    "j1",
"job_id still takes precedence",
  );
  assert.equal(
    resolveReaderJobId({ search: "", isMock: () => true, mockJobId: () => "mock-job-1" }),
    "mock-job-1",
"when neither is present, keep original mock fallback behavior",
  );
  assert.equal(
    resolveReaderJobId({ search: "", isMock: () => false, mockJobId: () => "mock-job-1" }),
    "",
  );
});

test("resolveReaderDocumentId: read document_id from URL", () => {
  assert.equal(resolveReaderDocumentId({ search: "?document_id=doc-abc" }), "doc-abc");
  assert.equal(resolveReaderDocumentId({ search: "?job_id=j1" }), "");
  assert.equal(resolveReaderDocumentId({ search: "" }), "");
});

test("buildReaderDocumentPageUrl: open reader.html with document_id, pass through mock scenario and anchor", () => {
  const port = createReaderDialogConfigPort({
    buildPageUrl: (path, params) => `${path}?${new URLSearchParams(params).toString()}`,
    mockScenarioProvider: () => "parallel",
  });
  const url = port.buildReaderDocumentPageUrl("doc-abc");
assert.ok(url.startsWith("./reader.html?"), "points to reader.html");
  const params = new URLSearchParams(url.split("?")[1]);
  assert.equal(params.get("document_id"), "doc-abc");
assert.equal(params.get("job_id"), null, "does not include job_id");
assert.equal(params.get("mock"), "parallel", "iframe is an independent document, mock scenario must be passed through");

  const anchored = port.buildReaderDocumentPageUrl("doc-abc", { pageIdx: 3, blockId: "b-1" });
  const anchoredParams = new URLSearchParams(anchored.split("?")[1]);
  assert.equal(anchoredParams.get("page_idx"), "3");
  assert.equal(anchoredParams.get("block_id"), "b-1");
});

test("buildReaderDocumentPageUrl: empty document_id returns empty string (don't accidentally open reader)", () => {
  const port = createReaderDialogConfigPort({
    buildPageUrl: (path, params) => `${path}?${new URLSearchParams(params).toString()}`,
    mockScenarioProvider: () => "",
  });
  assert.equal(port.buildReaderDocumentPageUrl(""), "");
  assert.equal(port.buildReaderDocumentPageUrl(null), "");
});
