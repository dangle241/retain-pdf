import test from "node:test";
import assert from "node:assert/strict";

import {
  buildErrorDiagnostic,
  messageForErrorBox,
} from "../src/js/utils/error-diagnostics.js";

test("buildErrorDiagnostic formats copyable frontend diagnostics", () => {
  const error = new Error("backend unavailable");
  error.status = 503;
  error.url = "/api/v1/jobs/job-1/pdf";

  const diagnostic = buildErrorDiagnostic(error, {
operation: "Download translated PDF",
    jobId: "job-1",
    now: () => "2026-06-18T12:00:00.000Z",
    details: {
      workflow: "book",
      api_key: "should-not-appear",
    },
    includeStack: false,
  });

  assert.equal(diagnostic.kind, "error-diagnostic");
assert.equal(diagnostic.summary, "Download translated PDF failed: backend unavailable");
assert.match(diagnostic.diagnostic, /Time: 2026-06-18T12:00:00\.000Z/);
assert.match(diagnostic.diagnostic, /Frontend Version: /);
assert.match(diagnostic.diagnostic, /Operation: Download translated PDF/);
  assert.match(diagnostic.diagnostic, /job_id: job-1/);
assert.match(diagnostic.diagnostic, /HTTP Status Code: 503/);
  assert.match(diagnostic.diagnostic, /URL: \/api\/v1\/jobs\/job-1\/pdf/);
  assert.match(diagnostic.diagnostic, /workflow: book/);
  assert.doesNotMatch(diagnostic.diagnostic, /should-not-appear/);
});

test("messageForErrorBox preserves normal strings and summarizes diagnostics", () => {
  assert.equal(messageForErrorBox("-"), "-");
  assert.equal(messageForErrorBox("plain"), "plain");
  assert.equal(messageForErrorBox({
    kind: "error-diagnostic",
summary: "Upload PDF file failed: HTTP 500",
    diagnostic: "full details",
}), "Upload PDF file failed: HTTP 500");
});
