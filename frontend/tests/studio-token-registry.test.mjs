import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Theme Studio Registry consistency gate:studio/token-registry.mjs each registered
// Tokens must actually exist in src/styles(Registry stale after schema evolution. Update registration. â Red first.,
// Instead of silently displaying null values in the admin panel)Reverse no lock.:Style side may contain entries not in registry.
// Internal variable(--decor-px runtime variables like this)。

import { REQUIRED_TOKENS, SELECTOR_TOKEN_MAP, TOKEN_GROUPS } from "../studio/token-registry.mjs";

const PROJECT_ROOT = process.cwd();

function allStylesText() {
  const chunks = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".css")) chunks.push(readFileSync(full, "utf8"));
    }
  };
  walk(join(PROJECT_ROOT, "src/styles"));
  return chunks.join("\n");
}

test("Registry tokens all truly exist in src/styles", () => {
  const css = allStylesText();
  const missing = [];
  for (const group of TOKEN_GROUPS) {
    for (const t of group.tokens) {
      if (!css.includes(`${t.name}:`)) missing.push(`${group.id}/${t.name}`);
    }
  }
assert.deepEqual(missing, [], "Registry token below does not exist in src/styles.(Contract drift)");
});

test("Mandatory list matches color contract group.,Click to select table reference token All registered.", () => {
  const registered = new Set(TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => t.name)));
assert.equal(REQUIRED_TOKENS.length, 20, "Color contract required. 20 items(_contract.css)");
  const unknown = [];
  for (const entry of SELECTOR_TOKEN_MAP) {
    for (const token of entry.tokens) {
      if (!registered.has(token)) unknown.push(`${entry.match} → ${token}`);
    }
  }
  assert.deepEqual(unknown, [], "Selected parse table references unregistered item. token");
});
