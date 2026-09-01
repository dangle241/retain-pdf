import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// DetailApp (Task Detail Page React Orchestration Root) component-level test:
// .jsx loaded directly via esbuild hook in tests/helpers/jsx-loader.mjs.
// Validate:Load Orchestration(overview → markdown)、setText/setActionLink adaptation,
// Imperative Island (Artifact List) Implement landing, on-demand event stream loading, and modal open/close.

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/detail.html?job_id=job-react-detail" });
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver", "NodeFilter"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key] ?? dom.window,
    writable: true,
    configurable: true,
  });
}
globalThis.window = dom.window;
globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
// Radix Presence/Tabs (introduced in Phase B) require cancelAnimationFrame under jsdom
// (TabsContent mount animation timer cleanup) and getComputedStyle (Presence reads
// animation-name to determine if exit animation ended) â implemented on jsdom window, but not
// copied to bare global like requestAnimationFrame; adding them here.
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { DetailApp } = await import("../src/pages/detail/DetailApp.jsx");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Process load varies during parallel tests, fixed wait causes jitter; poll until condition met (max 3s)
async function waitFor(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await wait(20);
  }
assert.fail(`Wait timeout:${description}`);
}

function click(element) {
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

function byId(id) {
  return dom.window.document.getElementById(id);
}

function makePorts() {
  const payloadRaw = {
    job_id: "job-react-detail",
    status: "succeeded",
    display_stage: "done",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:03:00Z",
    finished_at: "2026-06-01T00:03:00Z",
    runtime: {
      stage_history: [
        {
          stage: "translating",
          display_stage: "translation",
          enter_at: "2026-06-01T00:00:00Z",
          exit_at: "2026-06-01T00:01:00Z",
          duration_ms: 60000,
        },
        {
          stage: "rendering",
          display_stage: "render",
          enter_at: "2026-06-01T00:01:00Z",
          exit_at: "2026-06-01T00:03:00Z",
          duration_ms: 120000,
        },
      ],
    },
    artifacts: {
      markdown: {
        ready: true,
        json_url: "/api/v1/jobs/job-react-detail/markdown",
        raw_url: "/api/v1/jobs/job-react-detail/markdown/raw",
      },
    },
    actions: {
      download_pdf: { enabled: true, url: "/api/v1/jobs/job-react-detail/pdf" },
    },
  };
  const manifestPayload = {
    items: [
      { artifact_key: "source_pdf", ready: true, resource_path: "/api/v1/jobs/job-react-detail/artifacts/source_pdf" },
      { artifact_key: "translated_pdf", ready: true, resource_path: "/api/v1/jobs/job-react-detail/pdf" },
    ],
  };
  const eventItems = [
    { seq: 1, event: "stage_transition", level: "info", message: "Start translation", display_stage: "translation" },
    { seq: 2, event: "stage_transition", level: "info", message: "渲染完成", display_stage: "render" },
  ];
  const calls = { events: [] };
  return {
    calls,
    getJobId: () => "job-react-detail",
    configPort: { detailShareNote: () => "Share prompt(测试)" },
    resumePort: { submit: async () => ({ job_id: "job-next" }) },
    dataPort: {
      apiPrefix: "/api/v1",
      loadOverview: async () => ({
        diagnosticsPayload: null,
        manifestPayload,
        payloadRaw,
        resumePlan: { can_resume: true, from_stage: "translation" },
      }),
      loadMarkdownPayload: async () => ({
content: "# Test documentation\n\nBody content",
        file_name: "book.md",
        json_url: "/api/v1/jobs/job-react-detail/markdown",
        raw_url: "/api/v1/jobs/job-react-detail/markdown/raw",
        images: [],
      }),
      fetchJobEvents: async (jobId, apiPrefix, limit, offset) => {
        calls.events.push([jobId, apiPrefix, limit, offset]);
        return { items: eventItems };
      },
      fetchProtected: async () => {
        throw new Error("Test must not initiate protected requests.");
      },
      rerunJob: async () => ({}),
      resumeJob: async () => ({}),
    },
  };
}

test("DetailApp: load orchestration, copy adaptation, artifact isolation, event flow modal", async () => {
  const host = dom.window.document.createElement("div");
  host.id = "detail-root";
  dom.window.document.body.appendChild(host);

  const ports = makePorts();
  const root = createRoot(host);
  root.render(React.createElement(DetailApp, {
    configPort: ports.configPort,
    dataPort: ports.dataPort,
    getJobId: ports.getJobId,
    resumePort: ports.resumePort,
  }));
// Wait for both overview + markdown async orchestrations to land
  await waitFor(
() => /loaded/.test(byId("detail-markdown-status")?.textContent || ""),
"markdown status ready",
  );

// Header: job id and share prompt use setText adaptation
  assert.equal(byId("detail-job-id")?.textContent, "job-react-detail");
assert.equal(byId("detail-head-note")?.textContent, "Share prompt text(test)");
  assert.notEqual(byId("detail-status-summary")?.textContent, "-");

// Breakpoint recovery: resumePlan recoverable â text and button state (imperative write)
assert.match(byId("detail-rerun-status")?.textContent || "", /recoverable from translation/);
  assert.equal(byId("detail-rerun-btn")?.disabled, false);

// Action links: setActionLink adaptation (reader/pdf both ready)
  assert.equal(byId("detail-reader-btn")?.classList.contains("disabled"), false);
  assert.equal(byId("detail-reader-btn")?.getAttribute("aria-disabled"), "false");
  assert.equal(byId("detail-pdf-btn")?.classList.contains("disabled"), false);

// Artifact list: retained artifacts.js written to React container via overview-renderer imperatively
assert.equal(byId("detail-artifacts-summary")?.textContent, "2 items total");
  assert.equal(host.querySelectorAll(".detail-artifact-row").length, 2);

// Markdown: markdown-flow reuse â status and preview
assert.match(byId("detail-markdown-status")?.textContent || "", /loaded \/markdown JSON/);
assert.match(byId("detail-markdown-preview")?.textContent || "", /# Test Document/);
  assert.equal(byId("detail-markdown-image-count")?.textContent, "0");

// Stage timeline modal (Phase C final batch replaced with Radix Dialog, no forceMount: closed state
// Entire Content not mounted to DOM, assertion changed from "hidden class truth" to "is mounted"):
// Open to render entries, Escape to close
assert.equal(byId("detail-stage-history-modal"), null, "Not mounted when initially closed");
  click(byId("detail-open-stage-history-btn"));
  await waitFor(
    () => byId("detail-stage-history-modal") !== null,
"stage timeline modal opened",
  );
// Radix Dialog Content uses Portal, renders to document.body instead of host subtree,
// Assertion scope changed from host to entire document (mirroring other migrated dialog test precedents).
  assert.equal(dom.window.document.querySelectorAll(".detail-stage-item").length, 2);
  assert.match(dom.window.document.querySelector(".detail-stage-item .detail-stage-title")?.textContent || "", /^1\. /);
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await waitFor(
    () => byId("detail-stage-history-modal") === null,
"Escape closes stage timeline modal",
  );

// Event flow: on-demand paginated full fetch + page cache + button text becomes "View"
assert.equal(byId("detail-open-events-btn")?.textContent, "Load on demand");
assert.equal(byId("detail-events-modal"), null, "Not mounted when initially closed");
  click(byId("detail-open-events-btn"));
  await waitFor(
    () => dom.window.document.querySelectorAll(".detail-event-item").length === 2,
"event flow entries rendered",
  );
assert.ok(byId("detail-events-modal"), "Event flow modal mounted");
  assert.deepEqual(ports.calls.events, [["job-react-detail", "/api/v1", 200, 0]]);
assert.equal(byId("detail-events-status")?.textContent, "All events Â· 2 items");
assert.equal(byId("detail-open-events-btn")?.textContent, "View");

// Re-opening does not repeat request (page cache)
  click(byId("detail-close-events-btn"));
  await waitFor(
    () => byId("detail-events-modal") === null,
"close event flow modal",
  );
  click(byId("detail-open-events-btn"));
  await waitFor(
    () => byId("detail-events-modal") !== null,
"re-open event flow modal",
  );
  assert.equal(ports.calls.events.length, 1);

  root.unmount();
  host.remove();
});

test("DetailApp: prompt and no request when job_id is missing", async () => {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);

  let overviewCalls = 0;
  const root = createRoot(host);
  root.render(React.createElement(DetailApp, {
    configPort: { detailShareNote: () => "share" },
    dataPort: {
      apiPrefix: "/api/v1",
      loadOverview: async () => {
        overviewCalls += 1;
        return {};
      },
      loadMarkdownPayload: async () => null,
      fetchJobEvents: async () => ({ items: [] }),
      fetchProtected: async () => ({}),
    },
    getJobId: () => "",
    resumePort: { submit: async () => ({}) },
  }));
  await waitFor(
() => host.querySelector("#detail-head-note")?.textContent === "Missing job_id, please open via detail.html?job_id=...",
"missing job_id prompt",
  );
  assert.equal(overviewCalls, 0);

  root.unmount();
  host.remove();
});
