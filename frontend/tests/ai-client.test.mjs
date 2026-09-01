import test from "node:test";
import assert from "node:assert/strict";

// Make config/runtime.js isMockMode()/apiBase() available in Node (no jsdom required)
globalThis.window = globalThis.window || { location: { search: "", protocol: "http:", hostname: "127.0.0.1" } };

const { AiAskError, askLibraryAi, readAiAskStream } = await import("../src/js/api/ai.js");
const { setRuntimeConfig } = await import("../src/js/config/runtime.js");
const { buildScopedQuestion, createReaderAskAnswerer } = await import("../src/js/reader/ai/ask-answerer.js");

function sseStream(chunks = []) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

// ===== SSE Line parsing(/api/v1/ai/ask Streaming contract) =====

test("readAiAskStream:tool Sequential event callbacks,done Event returns normalized result.", async () => {
  const toolEvents = [];
// Event cross chunk Truncate + CRLF + non-data line, Buffer validation logic.
  const result = await readAiAskStream(sseStream([
    ': keep-alive\n',
    'data: {"type": "tool", "round": 1, "tool": "list_documents", "arguments": {"limit": 200}}\r\n\r\n',
    'data: {"type": "tool", "round": 2, "tool": "search_f',
    'ulltext", "arguments": {"query": "光谱"}}\n\n',
    'data: {"type": "done", "answer": "结论 [1]。", "citations": [{"ref": 1, "document_id": "doc-1", "job_id": "job-1", "page_idx": 3, "block_id": "p004-b0002", "snippet": "命中片段"}], "tool_trace": [{"round": 1, "tool": "list_documents"}], "rounds": 3}\n\n',
  ]), {
    onToolEvent: (event) => toolEvents.push(event),
  });

  assert.deepEqual(toolEvents.map((event) => [event.round, event.tool]), [
    [1, "list_documents"],
    [2, "search_fulltext"],
  ]);
assert.equal(result.answer, "Conclusion [1].");
  assert.equal(result.rounds, 3);
  assert.equal(result.citations.length, 1);
  assert.deepEqual(result.citations[0], {
    ref: 1,
    document_id: "doc-1",
    job_id: "job-1",
    page_idx: 3,
    block_id: "p004-b0002",
snippet: "hit snippet",
  });
  assert.equal(result.toolTrace.length, 1);
});

test("readAiAskStream:error Throw Event AiAskError", async () => {
  await assert.rejects(
    readAiAskStream(sseStream([
      'data: {"type": "tool", "round": 1, "tool": "search_fulltext", "arguments": {}}\n\n',
      'data: {"type": "error", "message": "上游模型超时"}\n\n',
    ])),
(error) => error instanceof AiAskError && /Upstream model timeout/.test(error.message),
  );
});

test("readAiAskStream: Stream interrupted (no done). Throw retryable error", async () => {
  await assert.rejects(
    readAiAskStream(sseStream([
      'data: {"type": "tool", "round": 1, "tool": "read_blocks", "arguments": {}}\n\n',
    ])),
(error) => error instanceof AiAskError && /interrupted/.test(error.message),
  );
});

test("readAiAskStream:No trailing newline done Also parses lines.", async () => {
  const result = await readAiAskStream(sseStream([
    'data: {"type": "done", "answer": "ok", "citations": [], "tool_trace": [], "rounds": 1}',
  ]));
  assert.equal(result.answer, "ok");
});

// ===== askLibraryAi:Request construction and error grading =====

test("askLibraryAi: Carry X-API-Key, body contains question/document_id/job_id/stream", async () => {
  setRuntimeConfig({ xApiKey: "test-key" });
  const calls = [];
  const result = await askLibraryAi({
question: "What is this about?",
    documentId: "doc-9",
    jobId: "job-9",
    fetchImpl: async (url, options) => {
      calls.push([url, options]);
      return {
        ok: true,
        headers: { get: () => "text/event-stream" },
        body: sseStream(['data: {"type": "done", "answer": "答", "citations": [], "tool_trace": [], "rounds": 1}\n\n']),
      };
    },
  });
  setRuntimeConfig({ xApiKey: "" });

assert.equal(result.answer, "Ans");
  assert.equal(calls.length, 1);
  const [url, options] = calls[0];
  assert.match(url, /\/api\/v1\/ai\/ask$/);
  assert.equal(options.method, "POST");
  assert.equal(options.headers["X-API-Key"], "test-key");
  assert.equal(options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(options.body), {
question: "What is this about?",
    document_id: "doc-9",
    job_id: "job-9",
    stream: true,
  });
});

test("askLibraryAi: 502 Throw AI Service Not Running status", async () => {
  await assert.rejects(
    askLibraryAi({
      question: "hi",
      fetchImpl: async () => ({ ok: false, status: 502, text: async () => "" }),
    }),
    (error) => error instanceof AiAskError && error.status === 502 && /AI Service not running/.test(error.message),
  );
});

test("askLibraryAi: 401 Parse FastAPI detail and prompt X-API-Key", async () => {
  await assert.rejects(
    askLibraryAi({
      question: "hi",
      fetchImpl: async () => ({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ detail: "invalid api key" }),
      }),
    }),
    (error) => error instanceof AiAskError
      && error.status === 401
      && /invalid api key/i.test(error.message),
  );
});

test("askLibraryAi: 400 Missing LLM key Timestamp passthrough/Merge readable copy", async () => {
  await assert.rejects(
    askLibraryAi({
      question: "hi",
      fetchImpl: async () => ({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({
detail: "Missing LLM API Key: Please fill in the model API Key in the frontend credential settings.",
        }),
      }),
    }),
    (error) => error instanceof AiAskError
      && error.status === 400
&& /LLM API Key|model API Key|credential/.test(error.message),
  );
});

test("askLibraryAi: Non-streaming JSON envelope Fallback unpack", async () => {
  const result = await askLibraryAi({
    question: "hi",
    fetchImpl: async () => ({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ code: 0, data: { answer: "非流式", citations: [], tool_trace: [], rounds: 2 } }),
    }),
  });
assert.equal(result.answer, "non-streaming");
  assert.equal(result.rounds, 2);
});

// ===== ask-answerer: document_id Reverse cache lookup with scope prefix =====

test("buildScopedQuestion: Page/Write selection range with prefix. question text", () => {
  assert.equal(buildScopedQuestion({ question: "总结一下", scope: "document" }), "总结一下");
  assert.equal(
buildScopedQuestion({ question: "Summarize", scope: "page", context: { page: 4 } }),
    "(current 4 Page summary",
  );
  assert.equal(
    buildScopedQuestion({
question: "Explain this part",
      scope: "selection",
      context: { page: 2, rect: {} },
      resolveQuote: () => ({ quoteText: "Selected  原文\n片段" }),
    }),
"(for the selected original segment:ãSelected original segmentã) explain this",
  );
  assert.equal(
buildScopedQuestion({ question: "Explain this part", scope: "selection", context: { page: 2 }, resolveQuote: () => null }),
    "(for page 2 Selected content on the page) Explain this.",
  );
});

// ===== chat rendering: References clickable; model text not injected. HTML =====

test("chat:agentic Response rendering [n] Clickable citations and footnotes,Model text XSS Security", async () => {
// Phase 2b: AI Q&A UI migrated to React (ReaderAiChat), Test now renders component.
// Via DOM Submit driver; Render semantic assertions (process prompts/XSS/citation buttons/footnotes) Unchanged.
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  for (const k of ["window", "document", "HTMLElement", "CustomEvent", "Event", "Node", "MutationObserver"]) {
    Object.defineProperty(globalThis, k, { value: dom.window[k] ?? dom.window, writable: true, configurable: true });
  }
  globalThis.window = dom.window;
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0);
// Radix Presence/Tabs (introduced in Phase B) requires cancelAnimationFrame under jsdom
// (TabsContent mount animation timer cleanup) and getComputedStyle (Presence reads
// animation-name to determine if exit animation ended) â implemented in jsdom window, but not
// copied to bare global like requestAnimationFrame; adding it here.
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  const documentRef = dom.window.document;
  const citation = {
    ref: 1,
    document_id: "doc-x",
    job_id: "job-x",
    page_idx: 3,
    block_id: "p004-b0002",
snippet: "hit snippet text",
  };
  const jumps = [];
  const progressTexts = [];
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { ReaderAiChat } = await import("../src/pages/reader/legacy/components/ReaderAiChat.jsx");
  const host = documentRef.createElement("div");
  documentRef.body.appendChild(host);
  createRoot(host).render(React.createElement(ReaderAiChat, {
    ports: {
      jobId: "job-x",
      historyStore: { load: () => ({ messages: [], history: [] }), save() {}, clear() {} },
      jumpToCitation: (target) => jumps.push(target),
      remoteAnswerer: {
        answer: async ({ onToolEvent }) => {
          onToolEvent?.({ type: "tool", round: 1, tool: "search_fulltext" });
          progressTexts.push(documentRef.querySelector(".reader-ai-message-assistant .reader-ai-message-body-el").textContent);
          return {
answer: 'Answer see [1].<img src=x onerror="alert(1)">',
            citations: [citation],
            rounds: 2,
          };
        },
        ensureLoaded: async () => true,
      },
    },
  }));

  const waitFor = async (predicate, description) => {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      if (predicate()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
assert.fail(`Wait timeout: ${description}`);
  };
await waitFor(() => documentRef.getElementById("reader-ai-input"), "composer mounted");
  const input = documentRef.getElementById("reader-ai-input");
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set;
  setter.call(input, "Molassembler what is?");
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  documentRef.querySelector("[data-reader-ai-composer]")
    .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await waitFor(
    () => documentRef.querySelector(".reader-ai-citations .reader-ai-citation-item"),
"Answer finalize (Footnotes appear).",
  );

  const assistant = documentRef.querySelector(".reader-ai-message-assistant");
  assert.deepEqual(progressTexts, ["Retrieving document content…"], "tool Render events as process prompt lines.");
  assert.ok(!assistant.className.includes("reader-ai-message-progress"), "Remove progress styles after completion.");
  assert.ok(!assistant.innerHTML.includes("<img"), "Model text must be inserted as plain text.");
  assert.match(assistant.textContent, /<img src=x/);

  const refButton = assistant.querySelector("button.reader-ai-citation-ref");
  assert.equal(refButton.textContent, "[1]");
  refButton.click();
  const footerButtons = assistant.querySelectorAll(".reader-ai-citations .reader-ai-citation-item");
  assert.equal(footerButtons.length, 1);
assert.match(footerButtons[0].textContent, /^\[1\] hit snippet text Â· Page 4$/);
  footerButtons[0].click();
  assert.deepEqual(jumps, [citation, citation], "Inline marker and footnote click target same citation.");
});

test("ask answerer: By job_id Direct query document_id SELECT * FROM table WHERE id = ? LIMIT 1", async () => {
  const listCalls = [];
  const askCalls = [];
  const answerer = createReaderAskAnswerer({
    jobId: "job-b",
    llmConfig: () => ({ apiKey: "sk-test", baseUrl: "", model: "" }),
    documentByJobId: async (apiPrefix, jobId) => {
      listCalls.push([apiPrefix, jobId]);
// Backend direct query: Resolve parent document from historical run.
      return { document_id: "doc-b", active_job_id: "job-a" };
    },
    ask: async (payload) => {
      askCalls.push(payload);
      payload.onToolEvent?.({ type: "tool", round: 1, tool: "search_fulltext" });
      return { answer: "回答", citations: [], toolTrace: [], rounds: 1 };
    },
  });

  const toolEvents = [];
  const first = await answerer.answer({
    question: "Question 1",
    scope: "document",
    onToolEvent: (event) => toolEvents.push(event),
  });
await answerer.answer({ question: "Question 2", scope: "page", context: { page: 3 } });

assert.equal(first.answer, "Answer");
  assert.equal(first.scope, "document");
  assert.equal(listCalls.length, 1, "document_id Direct query results should be cached.");
assert.deepEqual(listCalls[0][1], "job-b", "Direct query by job_id");
  assert.equal(askCalls[0].documentId, "doc-b");
  assert.equal(askCalls[0].jobId, "job-b");
assert.equal(askCalls[1].question, "(Current Page 3) Question 2");
  assert.equal(toolEvents.length, 1);
});

test("ask answerer: Reverse lookup not found. Fail closed for document, non-silent full database.", async () => {
  const askCalls = [];
  const answerer = createReaderAskAnswerer({
    jobId: "job-orphan",
    llmConfig: () => ({ apiKey: "sk-test", baseUrl: "", model: "" }),
    documentByJobId: async () => null,
    ask: async (payload) => {
      askCalls.push(payload);
      return { answer: "不应调用", citations: [], toolTrace: [], rounds: 0 };
    },
  });
  await assert.rejects(
    answerer.answer({ question: "这篇讲什么?", scope: "document" }),
    /Cannot associate current document./,
  );
  assert.equal(askCalls.length, 0);
});

test("ask answerer:No model Key Check docs before sending. ask", async () => {
  const listCalls = [];
  const askCalls = [];
  const answerer = createReaderAskAnswerer({
    jobId: "job-x",
    llmConfig: () => ({ apiKey: "", baseUrl: "", model: "" }),
    documentByJobId: async () => {
      listCalls.push(1);
      return { document_id: "doc-x" };
    },
    ask: async (payload) => {
      askCalls.push(payload);
      return { answer: "不应调用", citations: [], toolTrace: [], rounds: 0 };
    },
  });
  await assert.rejects(
    answerer.answer({ question: "hi", scope: "document" }),
/Missing model API Key/,
  );
assert.equal(listCalls.length, 0, "Missing Key: Documentation first. Read it.");
assert.equal(askCalls.length, 0, "Missing Key: Do not send ask");
});

test("askLibraryAi carries llm_api_key/base/model, only non-empty fields in payload", async () => {
  globalThis.window = { location: { search: "", protocol: "http:", hostname: "127.0.0.1" } };
  let sentBody = null;
  const fakeFetch = async (_url, options) => {
    sentBody = JSON.parse(options.body);
    return {
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ code: 0, message: "ok", data: { answer: "a", citations: [], tool_trace: [], rounds: 1 } }),
    };
  };
  await askLibraryAi({
question: "Question",
    documentId: "doc-1",
    apiPrefix: "/api/v1",
    fetchImpl: fakeFetch,
    llmApiKey: "  sk-frontend  ",
    llmModel: "deepseek-v4-flash",
  });
  assert.equal(sentBody.llm_api_key, "sk-frontend");
  assert.equal(sentBody.llm_model, "deepseek-v4-flash");
  assert.equal("llm_base_url" in sentBody, false);
  assert.equal(sentBody.document_id, "doc-1");
});

test("askLibraryAi payload excludes llm_* fields when llm key is missing (Backend fallback env)", async () => {
  globalThis.window = { location: { search: "", protocol: "http:", hostname: "127.0.0.1" } };
  let sentBody = null;
  const fakeFetch = async (_url, options) => {
    sentBody = JSON.parse(options.body);
    return {
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ code: 0, message: "ok", data: { answer: "a", citations: [] } }),
    };
  };
  await askLibraryAi({ question: "q", apiPrefix: "/api/v1", fetchImpl: fakeFetch });
  assert.equal("llm_api_key" in sentBody, false);
  assert.equal("llm_base_url" in sentBody, false);
  assert.equal("llm_model" in sentBody, false);
});
