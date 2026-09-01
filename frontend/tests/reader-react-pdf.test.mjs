import test from "node:test";
import assert from "node:assert/strict";
import { loadProtectedPdfFile } from "../src/pages/reader/pdf/useProtectedPdfFile.ts";

test("loadProtectedPdfFile returns null for empty url", async () => {
  assert.equal(await loadProtectedPdfFile(""), null);
});

test("loadProtectedPdfFile uses fetchProtected and returns data bytes", async () => {
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
  const file = await loadProtectedPdfFile("mock://demo.pdf", async (url) => {
    assert.equal(url, "mock://demo.pdf");
    return {
      ok: true,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    };
  });
  assert.ok(file);
  assert.equal(file.data[0], 0x25);
  assert.equal(file.data.length, 4);
});

test("loadProtectedPdfFile throws on non-ok response", async () => {
  await assert.rejects(
    () => loadProtectedPdfFile("http://x/pdf", async () => ({ ok: false, status: 404 })),
    /404/,
  );
});

import {
  clampReaderZoom,
  comparePaneWidth,
  defaultZoomForMode,
  displayPercentToZoom,
  fitContentWidth,
  pageWidthFromShell,
  stepReaderZoom,
  zoomToDisplayPercent,
  READER_ZOOM_MIN,
  READER_ZOOM_MAX,
  READER_ZOOM_DEFAULT,
} from "../src/pages/reader/pdf/reader-zoom.ts";

test("clampReaderZoom: 0.25–1 (fraction of full shell)", () => {
  assert.equal(clampReaderZoom(0.1), READER_ZOOM_MIN);
  assert.equal(clampReaderZoom(9), READER_ZOOM_MAX);
  assert.equal(clampReaderZoom(0.75), 0.75);
  assert.equal(READER_ZOOM_MAX, 1);
  assert.equal(READER_ZOOM_DEFAULT, 0.5);
});

test("stepReaderZoom steps by 0.05", () => {
  assert.equal(stepReaderZoom(0.5, 1), 0.55);
  assert.equal(stepReaderZoom(0.5, -1), 0.45);
  assert.equal(stepReaderZoom(READER_ZOOM_MIN, -1), READER_ZOOM_MIN);
});

test("display percent is zoom×100 (50% = half browser, 100% = full)", () => {
  assert.equal(zoomToDisplayPercent(0.5), 50);
  assert.equal(zoomToDisplayPercent(1), 100);
  assert.equal(displayPercentToZoom(50), 0.5);
  assert.equal(displayPercentToZoom(100), 1);
});

test("pageWidthFromShell: same zoom → same width regardless of mode concept", () => {
  const shell = 1000;
  const at50 = pageWidthFromShell(shell, 0.5);
  const at100 = pageWidthFromShell(shell, 1);
  // 50% ≈ half shell content (after pad)
  assert.equal(at50, fitContentWidth(shell * 0.5));
  assert.equal(at100, fitContentWidth(shell));
  // 50% width roughly half of 100% (padding makes not exact 2x but close)
  assert.ok(at100 > at50 * 1.5);
  // 对照半栏宽约等于 50% 页宽 + 少量 pad 误差范围内
  const halfPane = comparePaneWidth(shell);
  assert.ok(Math.abs(at50 - fitContentWidth(halfPane)) < 30);
});

test("defaultZoom 50% unifies single and compare column fill", () => {
  assert.equal(defaultZoomForMode("source"), 0.5);
  assert.equal(defaultZoomForMode("compare"), 0.5);
  assert.equal(zoomToDisplayPercent(defaultZoomForMode("compare")), 50);
});

import {
  READER_PAGE_ATTR,
  READER_PANE_ATTR,
  READER_PAGE_SLOT_CLASS,
  pageSelector,
  pageInPaneSelector,
  pageSlotSelector,
} from "../src/pages/reader/pdf/reader-dom-contract.ts";

test("reader-dom-contract: pageSelector strings", () => {
  assert.equal(pageSelector(), `[${READER_PAGE_ATTR}]`);
  assert.equal(pageSelector(undefined), `[${READER_PAGE_ATTR}]`);
  assert.equal(pageSelector(3), `[${READER_PAGE_ATTR}="3"]`);
  assert.equal(
    pageSelector(undefined, "source"),
    `[${READER_PAGE_ATTR}][${READER_PANE_ATTR}="source"]`,
  );
  assert.equal(
    pageSelector(2, "translated"),
    `[${READER_PAGE_ATTR}="2"][${READER_PANE_ATTR}="translated"]`,
  );
});

test("reader-dom-contract: pageInPaneSelector strings", () => {
  assert.equal(
    pageInPaneSelector("source"),
    `[${READER_PAGE_ATTR}][${READER_PANE_ATTR}="source"]`,
  );
  assert.equal(
    pageInPaneSelector("translated"),
    `[${READER_PAGE_ATTR}][${READER_PANE_ATTR}="translated"]`,
  );
});

test("reader-dom-contract: pageSlotSelector strings", () => {
  assert.equal(
    pageSlotSelector(),
    `.${READER_PAGE_SLOT_CLASS}[${READER_PAGE_ATTR}]`,
  );
});

import {
  clampPageNumber,
  scrollShellToPage,
} from "../src/pages/reader/pdf/scroll-to-page.ts";
import { JSDOM } from "jsdom";

test("clampPageNumber bounds", () => {
  assert.equal(clampPageNumber(0, 10), 1);
  assert.equal(clampPageNumber(99, 10), 10);
  assert.equal(clampPageNumber(3.7, 10), 3);
  assert.equal(clampPageNumber(NaN, 10), 1);
});

function makeScrollRootWithPages(pageCount = 5, pageHeight = 200) {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    pretendToBeVisual: true,
  });
  const { document } = dom.window;
  const root = document.createElement("div");
  root.style.cssText = "overflow:auto;height:400px;position:relative;";
  Object.defineProperty(root, "clientHeight", { value: 400, configurable: true });
  let scrollTop = 0;
  Object.defineProperty(root, "scrollTop", {
    get() {
      return scrollTop;
    },
    set(v) {
      scrollTop = Number(v) || 0;
    },
    configurable: true,
  });
  root.scrollTo = ({ top }) => {
    scrollTop = Math.max(0, Number(top) || 0);
  };

  root.getBoundingClientRect = () => ({
    top: 0,
    left: 0,
    bottom: 400,
    right: 300,
    width: 300,
    height: 400,
    x: 0,
    y: 0,
    toJSON() {},
  });

  for (let i = 1; i <= pageCount; i += 1) {
    const page = document.createElement("div");
    page.setAttribute("data-reader-page", String(i));
    page.setAttribute("data-reader-pane", "source");
    const topInContent = (i - 1) * pageHeight;
    page.getBoundingClientRect = () => {
      const top = topInContent - scrollTop;
      return {
        top,
        left: 0,
        bottom: top + pageHeight,
        right: 300,
        width: 300,
        height: pageHeight,
        x: 0,
        y: top,
        toJSON() {},
      };
    };
    root.appendChild(page);
  }

  document.body.appendChild(root);
  return { root, dom };
}

test("scrollShellToPage moves shared shell scrollTop near page top", () => {
  const { root, dom } = makeScrollRootWithPages(5, 200);
  assert.equal(scrollShellToPage(root, 3, "auto", "source"), true);
  assert.ok(Math.abs(root.scrollTop - 352) < 2, `scrollTop=${root.scrollTop}`);
  dom.window.close();
});

import {
  applyPageScrollProgress,
  measurePageScrollProgress,
  cloneProgress,
  readingFocusY,
  pickPageAtFocus,
  READER_SCROLL_FOCUS_PX,
} from "../src/pages/reader/pdf/scroll-to-page.ts";

test("locked progress apply is stable (no drift when re-applied)", () => {
  const { root, dom } = makeScrollRootWithPages(5, 200);
  root.scrollTop = 250;
  const progress = measurePageScrollProgress(root, "source");
  assert.ok(progress);
  assert.equal(progress.page, 2);
  const locked = cloneProgress(progress);
  applyPageScrollProgress(root, locked, "auto", "source");
  const first = root.scrollTop;
  applyPageScrollProgress(root, locked, "auto", "source");
  applyPageScrollProgress(root, locked, "auto", "source");
  assert.ok(Math.abs(root.scrollTop - first) < 1, `drift ${root.scrollTop - first}`);
  assert.ok(root.scrollTop < 600, `scrollTop=${root.scrollTop}`);
  dom.window.close();
});

test("readingFocusY uses READER_SCROLL_FOCUS_PX from root top", () => {
  const { root, dom } = makeScrollRootWithPages(3, 200);
  assert.equal(readingFocusY(root), READER_SCROLL_FOCUS_PX);
  assert.equal(readingFocusY(root, 20), 20);
  dom.window.close();
});

test("pickPageAtFocus matches measurePageScrollProgress page + fraction", () => {
  const { root, dom } = makeScrollRootWithPages(5, 200);
  root.scrollTop = 250;
  const progress = measurePageScrollProgress(root, "source");
  const pages = Array.from(root.querySelectorAll("[data-reader-page]"));
  const picked = pickPageAtFocus(pages, readingFocusY(root));
  assert.ok(progress && picked);
  assert.equal(picked.page, progress.page);
  assert.ok(Math.abs(picked.fraction - progress.fraction) < 0.001);
  dom.window.close();
});

test("pickPageAtFocus picks last page whose top is at or above focus line", () => {
  const { root, dom } = makeScrollRootWithPages(5, 200);
  root.scrollTop = 200;
  const pages = Array.from(root.querySelectorAll("[data-reader-page]"));
  const focusY = readingFocusY(root);
  const picked = pickPageAtFocus(pages, focusY);
  assert.ok(picked);
  assert.equal(picked.page, 2);
  dom.window.close();
});
