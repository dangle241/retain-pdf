import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// 阅读器抽屉壳与顶栏动作组(React 版):接替旧 reader.test.mjs 的
// 「reader side drawer controls favorites」——开合语义从 side-drawers.js 迁入
// drawer store + React 渲染,这里断言:互斥切换、is-open/inert、顶栏按钮
// aria-expanded/is-active、favorites 永不 inert、关闭按钮;以及下载菜单的
// 可用性/禁用原因(旧 download-actions DOM 控制器的等价断言)。

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const k of ["window", "document", "HTMLElement", "CustomEvent", "Event", "Node", "MutationObserver"]) {
  Object.defineProperty(globalThis, k, { value: dom.window[k] ?? dom.window, writable: true, configurable: true });
}
globalThis.window = dom.window;
globalThis.window.__FRONT_RUNTIME_CONFIG__ = { apiBase: "http://retainpdf.local:41000/api/v1" };
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
const { createReaderDrawerStore } = await import("../src/pages/reader/legacy/state/drawer-store.js");
const { ReaderTopbarActions } = await import("../src/pages/reader/legacy/components/ReaderTopbarActions.jsx");
const {
  ReaderAiDrawer,
  ReaderAnnotationsDrawer,
  ReaderFavoritesDrawer,
  ReaderMarkdownDrawer,
} = await import("../src/pages/reader/legacy/components/ReaderSideDrawers.jsx");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await wait(15);
  }
  assert.fail(`等待超时:${description}`);
}

const documentRef = dom.window.document;
const byId = (id) => documentRef.getElementById(id);

const { ReaderDownloadMenu } = await import("../src/pages/reader/legacy/components/ReaderDownloadMenu.jsx");

// 单次挂载,全文件共用(与真实页面一致:一个 store 管四抽屉 + 顶栏)。
// 额外挂一份带 context 的下载菜单(等价于 boot 注入清单后的形态)——
// node:test 下第二个 createRoot 不会被调度,全部并入这棵树。
const drawerStore = createReaderDrawerStore();
const host = documentRef.createElement("div");
documentRef.body.appendChild(host);
createRoot(host).render(React.createElement(
  React.Fragment,
  null,
  React.createElement(ReaderTopbarActions, { drawerStore, downloadContext: null }),
  React.createElement(ReaderFavoritesDrawer, { drawerStore }),
  React.createElement(ReaderAnnotationsDrawer, { drawerStore, ports: null }),
  React.createElement(ReaderMarkdownDrawer, { drawerStore }),
  React.createElement(ReaderAiDrawer, { drawerStore, chatPorts: null }),
  React.createElement(
    "div",
    { "data-testid": "menu-with-context" },
    React.createElement(ReaderDownloadMenu, {
      context: {
        fetchProtected: async () => ({ ok: true }),
        jobId: "job-reader",
        jobPayload: { job_id: "job-reader", output_pdf_ready: true },
        manifestPayload: {
          items: [
            { artifact_key: "source_pdf", ready: true, resource_path: "/api/v1/jobs/job-reader/artifacts/source_pdf" },
            { artifact_key: "pdf", ready: true, resource_path: "/api/v1/jobs/job-reader/artifacts/pdf" },
          ],
        },
      },
    }),
  ),
));
await waitFor(() => byId("reader-favorites-drawer"), "抽屉挂载");

test("drawer store:互斥开合与订阅通知", () => {
  const changes = [];
  const unsubscribe = drawerStore.subscribe((active) => changes.push(active));
  drawerStore.open("favorites");
  assert.equal(drawerStore.active(), "favorites");
  drawerStore.toggle("ai");
  assert.equal(drawerStore.active(), "ai");
  drawerStore.toggle("ai");
  assert.equal(drawerStore.active(), "");
  drawerStore.open("markdown");
  drawerStore.close("favorites"); // 关不相干的抽屉:active 不变
  assert.equal(drawerStore.active(), "markdown");
  drawerStore.close();
  assert.equal(drawerStore.active(), "");
  unsubscribe();
  assert.deepEqual(changes, ["favorites", "ai", "", "markdown", "markdown", ""]);
});

test("打开 favorites:is-open + 顶栏按钮点亮,favorites 永不 inert", async () => {
  drawerStore.open("favorites");
  await waitFor(() => byId("reader-favorites-drawer").classList.contains("is-open"), "favorites 打开");
  assert.equal(byId("reader-favorites-drawer").hasAttribute("inert"), false);
  assert.equal(byId("reader-favorites-toggle-btn").getAttribute("aria-expanded"), "true");
  assert.ok(byId("reader-favorites-toggle-btn").classList.contains("is-active"));
  // 其余抽屉关闭且 inert(favorites 之外的关闭抽屉不可交互)
  assert.ok(!byId("reader-ai-drawer").classList.contains("is-open"));
  assert.equal(byId("reader-ai-drawer").hasAttribute("inert"), true);
  assert.equal(byId("reader-markdown-drawer").hasAttribute("inert"), true);
});

test("互斥切换:打开 ai 抽屉会收起 favorites", async () => {
  drawerStore.open("favorites");
  await waitFor(() => byId("reader-favorites-drawer").classList.contains("is-open"), "favorites 打开");
  byId("reader-ai-toggle-btn").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await waitFor(() => byId("reader-ai-drawer").classList.contains("is-open"), "ai 打开");
  assert.ok(!byId("reader-favorites-drawer").classList.contains("is-open"));
  assert.equal(byId("reader-favorites-toggle-btn").getAttribute("aria-expanded"), "false");
  assert.equal(byId("reader-ai-drawer").hasAttribute("inert"), false);
  // favorites 即便关闭也不 inert(钉住的摘录浮层交互依赖它)
  assert.equal(byId("reader-favorites-drawer").hasAttribute("inert"), false);
});

test("关闭按钮:点 × 收起当前抽屉", async () => {
  drawerStore.open("markdown");
  await waitFor(() => byId("reader-markdown-drawer").classList.contains("is-open"), "markdown 打开");
  byId("reader-markdown-close-btn").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await waitFor(() => !byId("reader-markdown-drawer").classList.contains("is-open"), "markdown 收起");
  assert.equal(drawerStore.active(), "");
});

test("下载菜单:context 缺失时按钮禁用并给出原因", () => {
  for (const action of ["source", "sideBySide", "translated"]) {
    const button = byId(`reader-download-${action}-btn`);
    assert.equal(button.disabled, true, action);
    assert.equal(button.getAttribute("aria-disabled"), "true");
    assert.match(button.title, /PDF/);
  }
});

test("下载菜单:清单可用时按钮点亮并带下载 title", async () => {
  const menuHost = documentRef.querySelector('[data-testid="menu-with-context"]');
  // 注意:页内有两份菜单(顶栏 null-context + 本份),jsdom 的 #id 查询会经
  // document.getElementById 短路到第一份;改用 [id="..."] 属性选择器限定子树。
  await waitFor(() => menuHost.querySelector('[id="reader-download-source-btn"]'), "带 context 的菜单挂载");
  const sourceBtn = menuHost.querySelector('[id="reader-download-source-btn"]');
  const sideBtn = menuHost.querySelector('[id="reader-download-sideBySide-btn"]');
  const translatedBtn = menuHost.querySelector('[id="reader-download-translated-btn"]');
  assert.equal(sourceBtn.disabled, false);
  assert.match(sourceBtn.title, /下载原始 PDF/);
  assert.equal(sideBtn.disabled, false);
  assert.match(sideBtn.title, /下载对照 PDF/);
  assert.equal(translatedBtn.disabled, false);
  assert.match(translatedBtn.title, /下载译文 PDF/);
});
