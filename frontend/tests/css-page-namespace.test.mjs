import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

// Source-level namespace gatekeeping:reader/detail Source file selector must include page prefix.
// Build split by page. dist/css/{home,detail,reader}.cssCross-page pollution risk significantly reduced.
// Test remains locked.「Do not reader/detail Naked global selectors in source.」。

const PROJECT_ROOT = process.cwd();
const STYLES_ROOT = join(PROJECT_ROOT, "src/styles");

const GROUPS = [
  {
name: "reader page/Reader Component",
    files: [
      ...readdirSync(join(STYLES_ROOT, "reader"))
        .filter((f) => f.endsWith(".css"))
        .map((f) => join(STYLES_ROOT, "reader", f)),
    ],
    allowed: [
      /(\.|#)reader-/,
      /\[data-reader/,
      /^reader-dialog\b/, // <reader-dialog> Custom tag selector unnecessary. Use CSS class or ID.
      /body\.reader/,
      /^:root$/,
    ],
  },
  {
name: "detail page",
    files: [
      join(STYLES_ROOT, "pages.css"),
      ...readdirSync(join(STYLES_ROOT, "pages/detail"))
        .filter((f) => f.endsWith(".css"))
        .map((f) => join(STYLES_ROOT, "pages/detail", f)),
    ],
    allowed: [
      /(\.|#)detail-/,
      /\[data-detail/,
/\.markdown-/, // detail page Markdown Preview block
      /body\.detail/,
      /^:root$/,
    ],
  },
];

// Parse rule selectors, skip @keyframes Internal stepper selector(0%/from/to).
//
// Tailwind v4 after migration,Some style files switched to native. CSS Nested(`&:hover`/`& p`/`&.foo`)
// and `@utility <name> { ... }` syntax(v4 Output of official migration tool) After compilation, these two forms
// Equivalent to legacy flattened compound selector,Literal text no longer includes page prefix.,Need what? `&`
// Expand to nearest selector context(`@utility <name>` treated as `.<name>`),Otherwise, it will
// Fully compliant nested selector misidentified as"No namespace"。
function ruleSelectors(css) {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectors = [];
// Log each layer. { header, resolved }: resolved as null indicates this layer is pass-through.
// at-rule(@media/@keyframes etc), Do not create new selector context, `&` Traverse to find.
// Nearest real selector/`@utility` context.
  const stack = [];
  let buffer = "";

  const nearestResolved = () => {
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      if (stack[i].resolved) {
        return stack[i].resolved;
      }
    }
    return [""];
  };

  const resolveHeader = (header) => {
    const parents = nearestResolved();
    return header
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .flatMap((part) =>
        part.includes("&") ? parents.map((parent) => part.split("&").join(parent)) : [part],
      );
  };

  for (const ch of noComments) {
    if (ch === "{") {
      const header = buffer.trim();
      buffer = "";
      const inKeyframes = stack.some((frame) => frame.header.startsWith("@keyframes"));

      if (/^@utility\s+/.test(header)) {
        const name = header.replace(/^@utility\s+/, "").trim();
        stack.push({ header, resolved: [`.${name}`] });
      } else if (header.startsWith("@") || inKeyframes) {
        stack.push({ header, resolved: null });
      } else {
        const resolved = resolveHeader(header);
        selectors.push(...resolved);
        stack.push({ header, resolved });
      }
    } else if (ch === "}") {
      stack.pop();
      buffer = "";
    } else if (ch === ";") {
      buffer = "";
    } else {
      buffer += ch;
    }
  }
  return selectors;
}

for (const group of GROUPS) {
test(`${group.name} style file selectors all have page namespace`, () => {
    const violations = [];
    for (const file of group.files) {
      for (const selector of ruleSelectors(readFileSync(file, "utf8"))) {
        for (const part of selector.split(",")) {
          const trimmed = part.trim();
          if (!trimmed) {
            continue;
          }
          if (!group.allowed.some((pattern) => pattern.test(trimmed))) {
            violations.push(`${relative(PROJECT_ROOT, file)}: "${trimmed}"`);
          }
        }
      }
    }
    assert.deepEqual(
      violations,
      [],
`Following selectors lack page namespace.(Use reader-/detail- prefix):\n  ${violations.join("\n  ")}`,
    );
  });
}
