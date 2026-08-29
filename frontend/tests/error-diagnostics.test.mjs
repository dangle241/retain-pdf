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
    operation: "Tải xuống PDF bản dịch",
    jobId: "job-1",
    now: () => "2026-06-18T12:00:00.000Z",
    details: {
      workflow: "book",
      api_key: "should-not-appear",
    },
    includeStack: false,
  });

  assert.equal(diagnostic.kind, "error-diagnostic");
  assert.equal(diagnostic.summary, "Tải xuống PDF bản dịch thất bại：backend unavailable");
  assert.match(diagnostic.diagnostic, /Thời gian: 2026-06-18T12:00:00\.000Z/);
  assert.match(diagnostic.diagnostic, /Phiên bản frontend: /);
  assert.match(diagnostic.diagnostic, /Thao tác: Tải xuống PDF bản dịch/);
  assert.match(diagnostic.diagnostic, /job_id: job-1/);
  assert.match(diagnostic.diagnostic, /Mã trạng thái HTTP: 503/);
  assert.match(diagnostic.diagnostic, /URL: \/api\/v1\/jobs\/job-1\/pdf/);
  assert.match(diagnostic.diagnostic, /workflow: book/);
  assert.doesNotMatch(diagnostic.diagnostic, /should-not-appear/);
});

test("messageForErrorBox preserves normal strings and summarizes diagnostics", () => {
  assert.equal(messageForErrorBox("-"), "-");
  assert.equal(messageForErrorBox("plain"), "plain");
  assert.equal(messageForErrorBox({
    kind: "error-diagnostic",
    summary: "Tải lên tệp PDF thất bại：HTTP 500",
    diagnostic: "full details",
  }), "Tải lên tệp PDF thất bại：HTTP 500");
});
