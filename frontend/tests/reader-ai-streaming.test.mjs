import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// 流式渲染中间态(React 组件版):旧版驱动 chat.js,Phase 2b 迁入 React 后
// 改为渲染 ReaderAiChat 并经 DOM 提交驱动;断言语义不变——onAnswerDelta 到达时
// 气泡应出现"只含前几段"的中间渲染态(证明边流边渲染,而非只在末尾一次性渲染)。

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const k of ["window", "document", "HTMLElement", "CustomEvent", "Event", "Node", "MutationObserver"]) {
  Object.defineProperty(globalThis, k, { value: dom.window[k] ?? dom.window, writable: true, configurable: true });
}
globalThis.window = dom.window;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0);
// Radix Presence/Tabs(阶段 B 引入)在 jsdom 下需要 cancelAnimationFrame
// (TabsContent 的 mount 动画计时器清理)和 getComputedStyle(Presence 读取
// animation-name 判断退场动画是否结束)——jsdom 的 window 上有实现,只是没有
// 像 requestAnimationFrame 一样被复制到裸 global 上,这里一并补上。
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { ReaderAiChat } = await import("../src/pages/reader/legacy/components/ReaderAiChat.jsx");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await wait(15);
  }
  assert.fail(`等待超时:${description}`);
}

test("流式:onAnswerDelta 到达时气泡增量更新(finalize 前已有中间文本)", async () => {
  const documentRef = dom.window.document;
  const bodyText = () => documentRef.querySelector(".reader-ai-message-assistant .reader-ai-message-body-el")?.textContent || "";
  const snapshots = [];
  const host = documentRef.createElement("div");
  documentRef.body.appendChild(host);
  createRoot(host).render(React.createElement(ReaderAiChat, {
    ports: {
      jobId: "job-stream",
      historyStore: { load: () => ({ messages: [], history: [] }), save() {}, clear() {} },
      remoteAnswerer: {
        ensureLoaded: async () => true,
        // paced:分帧推增量,帧间留出 > 节流(90ms)的间隔,让中间渲染有机会触发
        answer: async ({ onAnswerDelta }) => {
          for (const chunk of ["第一段。", "第二段。", "第三段。"]) {
            onAnswerDelta?.((snapshots.at(-1)?.acc || "") + chunk, chunk);
            snapshots.push({ acc: (snapshots.at(-1)?.acc || "") + chunk });
            await wait(130);
            snapshots.push({ mid: bodyText() });
          }
          return { answer: "第一段。第二段。第三段。", citations: [], scope: "document" };
        },
      },
    },
  }));

  // 组件挂载 + restore/prepare 就绪后再提交
  await waitFor(() => documentRef.getElementById("reader-ai-input"), "composer 挂载");
  const input = documentRef.getElementById("reader-ai-input");
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set;
  setter.call(input, "测试流式");
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  documentRef.querySelector("[data-reader-ai-composer]")
    .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));

  await waitFor(() => /第一段。第二段。第三段。/.test(bodyText()), "最终态完整");
  await wait(50);

  // 中间快照里应出现"只含前几段、尚未全部"的状态(证明边流边渲染,而非只在末尾)
  const midTexts = snapshots.filter((s) => "mid" in s).map((s) => s.mid);
  assert.ok(midTexts.some((t) => t.includes("第一段") && !t.includes("第三段")),
    `应存在中间渲染态,实际: ${JSON.stringify(midTexts)}`);
  // 最终态完整
  assert.match(bodyText(), /第一段。第二段。第三段。/);
});
