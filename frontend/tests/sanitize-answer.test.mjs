import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeAssistantAnswer } from "../src/js/reader/ai/sanitize-answer.ts";

test("maps bracketed block_id to [n]", () => {
  const out = sanitizeAssistantAnswer(
"Preparation of chlorine-substituted spiroacridine (SA) precursor [p002-b0004] completed.",
    [{ ref: 2, block_id: "p002-b0004", page_idx: 1, snippet: "x" }],
  );
assert.equal(out, "Preparation of chlorine-substituted spiroacridine (SA) precursor [2] completed.");
});

test("strips unknown block_id markers", () => {
const out = sanitizeAssistantAnswer("Text [p009-b0010] end", []);
assert.equal(out, "Text end");
});

test("maps bare block_id", () => {
  const out = sanitizeAssistantAnswer(
"See p003-b0001",
    [{ ref: 1, block_id: "p003-b0001", page_idx: 2 }],
  );
assert.equal(out, "See [1]");
});

// citation protect/restore for markdown
import {
  protectNumericCitations,
  restoreNumericCitations,
} from "../src/js/reader/ai/render-answer-html.ts";

test("protectNumericCitations survives marked-like processing", async () => {
  const { marked } = await import("../vendor/marked/lib/marked.esm.js");
const src = "Conclusion holds [1], see experiment [2] for details.";
  const { text, refs } = protectNumericCitations(src);
  assert.equal(refs.join(","), "1,2");
  assert.ok(!text.includes("[1]"));
  const html = String(marked.parse(text, { async: false }));
  const restored = restoreNumericCitations(html, refs);
  assert.match(restored, /\[1\]/);
  assert.match(restored, /\[2\]/);
});

// Code protection (Audit P1-6 regression lock): Fenced/inline code unaffected by whitespace collapsing and block_id cleaning
test("fenced code keeps indentation and internal spacing", () => {
  const code = "```python\ndef f():\n    if x:\n        return  [1, 2]\n```";
const out = sanitizeAssistantAnswer(`Conclusion as follows:\n${code}\nFinished   now`, []);
assert.ok(out.includes("    if x:"), "Four-space indentation preserved");
assert.ok(out.includes("        return  [1, 2]"), "Eight-space indentation and double spaces preserved");
assert.ok(out.includes("Finished now"), "Multiple spaces outside code still collapsed");
});

test("unclosed fence at stream end is still protected", () => {
const out = sanitizeAssistantAnswer("Check code:\n\n    indented", []);
assert.ok(out.includes("    indented"), "Indentation inside unclosed streaming fence preserved");
});

test("inline code keeps content, block ids inside code untouched", () => {
const out = sanitizeAssistantAnswer("Field `p002-b0004  x` should not be modified", []);
assert.ok(out.includes("`p002-b0004  x`"), "block_id and double spaces in inline code preserved");
});
