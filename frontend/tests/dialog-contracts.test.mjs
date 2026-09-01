import test from "node:test";
import assert from "node:assert/strict";

// cutover 说明:旧世界的对话框 HTML 模板文件(reader/ai-assistant/app-settings/
// status-detail/glossary-manager 的 *-dialog-template.js)、features/developer/*、
// features/reader-dialog/{view.js,legacy-dom-adapter.js} 已随 home 页 cutover 删除
// (React 组件树取代)。本文件原有的"模板 markup 含契约 id"类用例随之删除;
// 保留的 3 个用例测的是纯逻辑(reader-dialog-contract.js 的 readerDialogLinkOpenState、
// reader-dialog/config-port.js 的 URL/消息可信度解析),与 DOM 模板无关,继续保活。

import {
  READER_DIALOG_CLASSES,
  READER_DIALOG_DATASETS,
  readerDialogLinkOpenState,
} from "../src/js/components/dialogs/reader-dialog-contract.js";
import { createReaderDialogConfigPort } from "../src/js/features/reader-dialog/config-port.js";

test("reader dialog link open state uses the shared external trigger contract", () => {
  const classes = new Set([READER_DIALOG_CLASSES.disabled]);
  const link = {
    dataset: {
      [READER_DIALOG_DATASETS.url]: "./reader.html?job_id=job-reader",
    },
    disabled: false,
    classList: {
      contains(name) {
        return classes.has(name);
      },
    },
    getAttribute(name) {
      return name === "aria-disabled" ? "false" : "";
    },
  };

  assert.deepEqual(readerDialogLinkOpenState(link), {
    url: "./reader.html?job_id=job-reader",
    disabled: true,
  });

  classes.clear();
  link.disabled = true;
  assert.deepEqual(readerDialogLinkOpenState({ currentTarget: link }), {
    url: "./reader.html?job_id=job-reader",
    disabled: true,
  });
});

test("reader dialog config port owns reader URLs and message trust", () => {
  const trustCalls = [];
  const port = createReaderDialogConfigPort({
    buildPageUrl(path, params) {
      return `app://${path}?job_id=${params.job_id}`;
    },
    trustWindowMessage(event, source) {
      trustCalls.push([event.origin, source]);
      return event.origin === "app://retainpdf";
    },
    locationProvider: () => ({
      href: "http://localhost/index.html?view=reader&job_id=job-123",
    }),
  });

  assert.equal(port.buildReaderPageUrl("job-123"), "app://./reader.html?job_id=job-123");
  assert.equal(port.buildReaderPageUrl(""), "");
  assert.equal(
    port.buildReaderRouteUrl("job-456"),
    "http://localhost/index.html?view=reader&job_id=job-456",
  );
  assert.equal(port.buildReaderRouteUrl(""), "http://localhost/index.html");
  assert.equal(port.requestedReaderJobIdFromLocation(), "job-123");
  assert.equal(port.isTrustedReaderMessage({ origin: "app://retainpdf" }, "frame"), true);
  assert.deepEqual(trustCalls, [["app://retainpdf", "frame"]]);
});

test("reader dialog config port ignores location job id outside reader view", () => {
  const port = createReaderDialogConfigPort({
    locationProvider: () => ({
      href: "http://localhost/index.html?view=library&job_id=job-123",
    }),
  });

  assert.equal(port.requestedReaderJobIdFromLocation(), "");
});
