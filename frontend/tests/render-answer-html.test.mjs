import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// AI Render answer. XSS Vector lock (audit P0-1 Reentrant lock.
// renderFinalAnswerHtml output via root.innerHTML injection, file locked.:
// Any raw output from the model HTML Only as"escape text → skipped: use stdlib, add when custom escaping needed."Form appears,Must not be a live element./Property.
// Sanitization policy change must allow all these vectors to pass through.

const dom = new JSDOM("<!doctype html><body></body>");
globalThis.document = dom.window.document;

const { renderFinalAnswerHtml, renderStreamingPreviewHtml } = await import(
  "../src/js/reader/ai/render-answer-html.ts"
);

/** Reparse output, assert no dangerous live elements exist/properties */
function assertInert(html, label) {
  const template = dom.window.document.createElement("template");
  template.innerHTML = html;
  const bad = template.content.querySelectorAll(
    "script, iframe, object, embed, base, link, meta, form, [srcdoc]",
  );
assert.equal(bad.length, 0, `{label}: dangerous element present {bad[0]?.outerHTML?.slice(0, 80) || ""}`);
  for (const node of template.content.querySelectorAll("*")) {
    for (const attribute of [...node.attributes]) {
assert.ok(!/^on/i.test(attribute.name), `{label}: event attribute {attribute.name} present`);
      if (["href", "src"].includes(attribute.name.toLowerCase())) {
        assert.ok(
          !/^\s*(javascript|vbscript|data:text\/html)/i.test(attribute.value),
`{label}: dangerous URL ${attribute.value.slice(0, 60)},
        );
      }
    }
  }
}

test("iframe srcdoc vector (proven bypass) is neutralized", async () => {
  const html = await renderFinalAnswerHtml(
'Conclusion as follows  [1]',
  );
  assertInert(html, "iframe-srcdoc");
assert.ok(html.includes("[1]"), "citation marker preserved");
});

test("script/object/embed/on*/javascript: all vectors neutralized", async () => {
  const html = await renderFinalAnswerHtml(
    [
      "<script>alert(1)</script>",
      '<object data="x"></object>',
      '<embed src="x">',
      '<img src=x onerror="alert(2)">',
'Click me',
      '<a href="vbscript:x">v</a>',
      '<a href="data:text/html,<script>1</script>">d</a>',
    ].join("\n\n"),
  );
assertInert(html, "all vectors");
});

test("Normal Markdown capabilities unaffected: bold/code/link/citation markers", async () => {
  const html = await renderFinalAnswerHtml(
    "**结论** 与 `code` 成立 [2]，见 [文档](https://example.com/a)。",
  );
assert.ok(html.includes("<strong>Conclusion</strong>"));
  assert.ok(html.includes("<code>code</code>"));
  assert.ok(/href="https:\/\/example\.com\/a"/.test(html));
assert.ok(!/target=/.test(html), "target attribute stripped (Electron window.open guard)");
  assert.ok(html.includes("[2]"));
});

test("streaming preview is fully escaped, original HTML presented as text", () => {
const html = renderStreamingPreviewHtml(' Bold [3]');
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;img"));
assert.ok(html.includes("<strong>Bold</strong>"));
  assert.ok(html.includes("[3]"));
});
