import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Stage planner test: manifest â Pure function layer of render plan (No jsdom components).
// Key constraints:Package-shipped. decor/*/manifest.json Always validate via contract.——
// corrupted assets manifest Red here first.,instead of silent non-rendering at runtime.

import { planStage } from "../src/shared/decor/stage-plan.js";

const PROJECT_ROOT = process.cwd();

function shippedManifest(pack) {
  return JSON.parse(readFileSync(join(PROJECT_ROOT, `decor/${pack}/manifest.json`), "utf8"));
}

test("Shipped jiangnan manifest passes contract validation and produces plan", () => {
  const result = planStage(shippedManifest("jiangnan"), { assetBase: "decor/jiangnan" });
  assert.deepEqual(result.errors, []);
  assert.ok(result.ok);
  const { plan } = result;
  assert.equal(plan.layers.length, 3);
  // Path appended with assetBase
  assert.ok(plan.layers.every((l) => l.src.startsWith("decor/jiangnan/")));
// band from slots registry:backdrop=bg,Item=mid
  assert.equal(plan.layers.find((l) => l.slot === "backdrop")?.band, "bg");
  assert.equal(plan.layers.find((l) => l.slot === "left-bottom")?.band, "mid");
  // Inscription
assert.equal(plan.quote?.text.includes("ä¹¦èä¸å·"), true);
  assert.equal(plan.quote?.writingMode, "vertical");
});

test("model layer renders fallback static image on image-based stage", () => {
  const manifest = {
    version: 1,
    id: "demo",
    layers: [
      { type: "image", slot: "backdrop", src: "bg.webp" },
      {
        type: "model",
        slot: "hero",
        src: "girl.glb",
        fallback: "girl.webp",
        idleClip: "Breathe",
      },
    ],
  };
  const result = planStage(manifest, { assetBase: "decor/demo" });
  assert.ok(result.ok);
  const hero = result.plan.layers.find((l) => l.slot === "hero");
assert.equal(hero.src, "decor/demo/girl.webp", "model layer should fall back to fallback image");
});

test("parallax all zeroed under reduced-motion", () => {
  const result = planStage(shippedManifest("jiangnan"), {
    assetBase: "decor/jiangnan",
    reducedMotion: true,
  });
  assert.ok(result.ok);
  assert.ok(result.plan.layers.every((l) => l.parallax === 0));
});

test("invalid manifest returns error list instead of plan", () => {
  const result = planStage({ version: 1, id: "bad", layers: [] }, { assetBase: "x" });
  assert.equal(result.ok, false);
  assert.equal(result.plan, null);
  assert.ok(result.errors.length > 0);
});

test("assetBase trailing slash normalized to prevent double slash paths", () => {
  const result = planStage(shippedManifest("jiangnan"), { assetBase: "decor/jiangnan/" });
  assert.ok(result.ok);
  assert.ok(result.plan.layers.every((l) => !l.src.includes("//")));
});

test("clickQuote passes validation and is delivered with plan, invalid values rejected", () => {
  const manifest = {
    version: 1,
    id: "demo",
    layers: [{ type: "image", slot: "right-bottom", src: "a.webp", clickQuote: "甲\n\n乙" }],
  };
  const result = planStage(manifest, { assetBase: "decor/demo" });
  assert.ok(result.ok);
assert.equal(result.plan.layers[0].clickQuote, "ç²\n\nä¹");

  const bad = planStage(
    { version: 1, id: "demo", layers: [{ type: "image", slot: "right-bottom", src: "a.webp", clickQuote: "  " }] },
    { assetBase: "decor/demo" },
  );
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.includes("clickQuote")));
});
