import test from "node:test";
import assert from "node:assert/strict";

// Decor package manifest Contract testing: schema Truthy value is src/shared/decor/contract.ts,
// Lock validation behavior here.——Stage engine and asset pipeline gatekeepers recognize only validateDecorManifest,
// Validation relaxed/Tightening exposes before real asset ingestion.

import {
  MAX_LAYERS,
  MAX_MODEL_LAYERS,
  validateDecorManifest,
} from "../src/shared/decor/contract.js";
import { DECOR_SLOTS, getDecorSlot, isDecorSlotId } from "../src/shared/decor/slots.js";

/** Concept draft "Guofeng" Minimum valid theme. manifest (Same example as DECOR_PACKS.md documentation) */
function sampleManifest() {
  return {
    version: 1,
    id: "guofeng",
    layers: [
      { type: "image", slot: "backdrop", src: "bg.webp", parallax: 0.05 },
      { type: "image", slot: "left-bottom", src: "dragon.webp" },
      {
        type: "model",
        slot: "left-top",
        src: "girl.glb",
        fallback: "girl.webp",
        idleClip: "Breathe",
        clickClip: "TurnPage",
      },
    ],
    quote: { slot: "quote", text: "知其所来\n明其所往" },
  };
}

test("slots Registry: unique id, valid band, overUi only with fg", () => {
  const ids = DECOR_SLOTS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "slot id No duplicates allowed.");
  for (const slot of DECOR_SLOTS) {
assert.ok(["bg", "mid", "fg"].includes(slot.band), `${slot.id} band invalid`);
    if (slot.overUi) {
assert.equal(slot.band, "fg", `${slot.id}: only fg allows pressure UI`);
    }
  }
  assert.ok(isDecorSlotId("backdrop"));
  assert.ok(!isDecorSlotId("made-up-slot"));
  assert.ok(getDecorSlot("quote")?.textCapable, "quote anchor must support text");
});

test("Valid manifest passes validation and returns unchanged.", () => {
  const result = validateDecorManifest(sampleManifest());
  assert.deepEqual(result.errors, []);
  assert.ok(result.ok);
  assert.equal(result.manifest.id, "guofeng");
  assert.equal(result.manifest.layers.length, 3);
});

test("Non-object / invalid version / invalid package name rejected.", () => {
  assert.equal(validateDecorManifest(null).ok, false);
  assert.equal(validateDecorManifest([]).ok, false);

  const badVersion = { ...sampleManifest(), version: 2 };
  const r1 = validateDecorManifest(badVersion);
  assert.equal(r1.ok, false);
  assert.ok(r1.errors.some((e) => e.includes("version")));

  const badId = { ...sampleManifest(), id: "GuoFeng_1" };
  const r2 = validateDecorManifest(badId);
  assert.equal(r2.ok, false);
  assert.ok(r2.errors.some((e) => e.includes("kebab-case")));
});

test("model Layer missing fallback Rejected(The fallback chain is a hard contract.)", () => {
  const m = sampleManifest();
  delete m.layers[2].fallback;
  const result = validateDecorManifest(m);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("fallback")));
});

test("Unregistered slot / slot Duplicate occupancy rejected.", () => {
  const unknown = sampleManifest();
  unknown.layers[1].slot = "left-middle";
  const r1 = validateDecorManifest(unknown);
  assert.equal(r1.ok, false);
assert.ok(r1.errors.some((e) => e.includes("not in slots.ts registry")));

  const dup = sampleManifest();
dup.layers[1].slot = "left-top"; // collides with layers[2]
  const r2 = validateDecorManifest(dup);
  assert.equal(r2.ok, false);
  assert.ok(r2.errors.some((e) => e.includes("Already in use")));
});

test("backdrop forbids 3D; 3D layer limit exceeded.", () => {
  const bg3d = sampleManifest();
  bg3d.layers[0] = { type: "model", slot: "backdrop", src: "bg.glb", fallback: "bg.webp" };
  const r1 = validateDecorManifest(bg3d);
  assert.equal(r1.ok, false);
assert.ok(r1.errors.some((e) => e.includes("background slot forbids 3D")));

  const slots = ["left-top", "left-bottom", "right-top", "right-bottom"];
  const many = {
    version: 1,
    id: "overload",
    layers: slots.map((slot, i) => ({
      type: "model",
      slot,
      src: `m${i}.glb`,
      fallback: `m${i}.webp`,
    })),
  };
  assert.ok(slots.length > MAX_MODEL_LAYERS, "Test prerequisites.:Exceeds model limit.");
  const r2 = validateDecorManifest(many);
  assert.equal(r2.ok, false);
assert.ok(r2.errors.some((e) => e.includes("3D layer")));
});

test("Path traversal / protocol / invalid extension rejected", () => {
  const cases = [
    { patch: { src: "../secret.webp" }, hint: "Relative path." },
{ patch: { src: "/abs/path.webp" }, hint: "relative path" },
    { patch: { src: "https://cdn.evil/x.webp" }, hint: "Relative path" },
    { patch: { src: "photo.jpeg" }, hint: "webp/png/svg/avif" },
  ];
  for (const { patch, hint } of cases) {
    const m = sampleManifest();
    Object.assign(m.layers[1], patch);
    const result = validateDecorManifest(m);
    assert.equal(result.ok, false, `Reject ${JSON.stringify(patch)}`);
    assert.ok(
      result.errors.some((e) => e.includes(hint)),
`Error message must include "${hint}", actual: ${result.errors.join(" | ")}`,
    );
  }

  const badModel = sampleManifest();
  badModel.layers[2].src = "girl.fbx";
  const r = validateDecorManifest(badModel);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes(".glb")));
});

test("parallax / opacity Out-of-bounds rejected", () => {
  const badParallax = sampleManifest();
  badParallax.layers[0].parallax = 0.5;
  assert.equal(validateDecorManifest(badParallax).ok, false);

  const badOpacity = sampleManifest();
  badOpacity.layers[1].opacity = 0;
  assert.equal(validateDecorManifest(badOpacity).ok, false);
});

test("quote can only be attached to textCapable anchors", () => {
  const m = sampleManifest();
  m.quote.slot = "hero";
  const result = validateDecorManifest(m);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("textCapable")));
});

test("Total layers exceed limit. Rejected.", () => {
  // slot Cannot satisfy uniqueness constraint. >MAX_LAYERS valid layer,
  // Use duplication directly slot ultra-long array——Report simultaneously."Quantity limit exceeded"。
  const m = {
    version: 1,
    id: "toomany",
    layers: Array.from({ length: MAX_LAYERS + 1 }, () => ({
      type: "image",
      slot: "hero",
      src: "x.webp",
    })),
  };
  const result = validateDecorManifest(m);
  assert.equal(result.ok, false);
assert.ok(result.errors.some((e) => e.includes("exceeds limit")));
});
