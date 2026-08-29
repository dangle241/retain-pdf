import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Test stage planner: manifest → render plan thuần hàm (không gắn component jsdom).
// Ràng buộc then chốt: manifest.json đi kèm package phải luôn vượt kiểm định hợp đồng —
// sửa manifest hư sẽ báo đỏ ở đây trước, thay vì không render âm thầm khi chạy.

import { planStage } from "../src/shared/decor/stage-plan.js";

const PROJECT_ROOT = process.cwd();

function shippedManifest(pack) {
  return JSON.parse(readFileSync(join(PROJECT_ROOT, `decor/${pack}/manifest.json`), "utf8"));
}

test("Manifest jiangnan đi kèm gói vượt kiểm định hợp đồng và tạo kế hoạch", () => {
  const result = planStage(shippedManifest("jiangnan"), { assetBase: "decor/jiangnan" });
  assert.deepEqual(result.errors, []);
  assert.ok(result.ok);
  const { plan } = result;
  assert.equal(plan.layers.length, 3);
  // Đường dẫn đã ghép thêm assetBase
  assert.ok(plan.layers.every((l) => l.src.startsWith("decor/jiangnan/")));
  // band đến từ slots registry: backdrop=bg, props=mid
  assert.equal(plan.layers.find((l) => l.slot === "backdrop")?.band, "bg");
  assert.equal(plan.layers.find((l) => l.slot === "left-bottom")?.band, "mid");
  // Câu đề
  assert.equal(plan.quote?.text.includes("Vạn quyển sách trân"), true);
  assert.equal(plan.quote?.writingMode, "vertical");
});

test("model lớp render ảnh tĩnh fallback trong sân khấu phiên bản hình ảnh", () => {
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
  assert.equal(hero.src, "decor/demo/girl.webp", "model lớp nên rơi về ảnh fallback");
});

test("reduced-motion thì parallax toàn bộ về 0", () => {
  const result = planStage(shippedManifest("jiangnan"), {
    assetBase: "decor/jiangnan",
    reducedMotion: true,
  });
  assert.ok(result.ok);
  assert.ok(result.plan.layers.every((l) => l.parallax === 0));
});

test("Manifest không hợp lệ trả về danh sách lỗi thay vì kế hoạch", () => {
  const result = planStage({ version: 1, id: "bad", layers: [] }, { assetBase: "x" });
  assert.equal(result.ok, false);
  assert.equal(result.plan, null);
  assert.ok(result.errors.length > 0);
});

test("assetBase dấu gạch chéo cuối được chuẩn hóa, không tạo đường dẫn double slash", () => {
  const result = planStage(shippedManifest("jiangnan"), { assetBase: "decor/jiangnan/" });
  assert.ok(result.ok);
  assert.ok(result.plan.layers.every((l) => !l.src.includes("//")));
});

test("clickQuote vượt qua kiểm tra và được gửi theo kế hoạch, giá trị không hợp lệ bị từ chối", () => {
  const manifest = {
    version: 1,
    id: "demo",
    layers: [{ type: "image", slot: "right-bottom", src: "a.webp", clickQuote: "甲\n\n乙" }],
  };
  const result = planStage(manifest, { assetBase: "decor/demo" });
  assert.ok(result.ok);
  assert.equal(result.plan.layers[0].clickQuote, "甲\n\n乙");

  const bad = planStage(
    { version: 1, id: "demo", layers: [{ type: "image", slot: "right-bottom", src: "a.webp", clickQuote: "  " }] },
    { assetBase: "decor/demo" },
  );
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.includes("clickQuote")));
});
