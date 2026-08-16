// Bộ lập kế hoạch sân khấu: manifest (JSON chưa biết) → kế hoạch render (dữ liệu thuần).
//
// Component DecorStage chỉ dùng đầu ra tại đây, không tự phân tích manifest; xác thực/fallback/phân giải đường dẫn
// đều nằm trong hàm thuần để node:test kiểm tra trực tiếp (không cần jsdom mount component).
//
// Chuỗi fallback (hợp đồng docs/theme-system/DECOR_PACKS.md):
// - Lớp model dưới sân khấu bản ảnh/không WebGL/reduced-motion → render ảnh tĩnh fallback.
// - reduced-motion → mọi parallax về 0.
// Hợp đồng: ./contract.ts · Neo: ./slots.ts.

import { validateDecorManifest } from "./contract.js";
import { getDecorSlot, type DecorLayerBand, type DecorSlotId } from "./slots.js";

export type StageLayerPlan = {
  key: string;
  slot: DecorSlotId;
  band: DecorLayerBand;
  /** Địa chỉ ảnh đã nối assetBase (lớp model trong sân khấu bản ảnh = fallback của nó). */
  src: string;
  /** 0 = không chuyển động (buộc 0 dưới reduced-motion). */
  parallax: number;
  opacity: number;
  /** Câu trích dẫn hiển thị khi bấm lớp (tùy chọn cho lớp image; nhiều câu phân tách bằng "\n\n"). */
  clickQuote?: string;
};

export type StageQuotePlan = {
  slot: DecorSlotId;
  band: DecorLayerBand;
  text: string;
  writingMode: "vertical" | "horizontal";
};

export type StagePlan = {
  layers: StageLayerPlan[];
  quote: StageQuotePlan | null;
};

export type StagePlanResult =
  | { ok: true; plan: StagePlan; errors: [] }
  | { ok: false; plan: null; errors: string[] };

export type StagePlanOptions = {
  /** URL gốc gói trang trí (không có dấu gạch chéo cuối), ví dụ "decor/jiangnan". */
  assetBase: string;
  /** prefers-reduced-motion: parallax về 0 (sân khấu bản ảnh vốn không render 3D). */
  reducedMotion?: boolean;
};

export function planStage(input: unknown, options: StagePlanOptions): StagePlanResult {
  const validated = validateDecorManifest(input);
  if (!validated.ok) {
    return { ok: false, plan: null, errors: validated.errors };
  }
  const { manifest } = validated;
  const base = options.assetBase.replace(/\/+$/, "");
  const reduced = !!options.reducedMotion;

  const layers: StageLayerPlan[] = manifest.layers.map((layer, i) => {
    const band = getDecorSlot(layer.slot)?.band ?? "mid";
    // Sân khấu bản ảnh: lớp model luôn dùng ảnh tĩnh fallback (sau khi tích hợp engine Three mới phân nhánh theo khả năng).
    const file = layer.type === "model" ? layer.fallback : layer.src;
    return {
      key: `${manifest.id}:${i}:${layer.slot}`,
      slot: layer.slot,
      band,
      src: `${base}/${file}`,
      parallax: reduced ? 0 : layer.parallax ?? 0,
      opacity: layer.type === "image" ? layer.opacity ?? 1 : 1,
      clickQuote: layer.type === "image" ? layer.clickQuote : undefined,
    };
  });

  const quote: StageQuotePlan | null = manifest.quote
    ? {
        slot: manifest.quote.slot,
        band: getDecorSlot(manifest.quote.slot)?.band ?? "mid",
        text: manifest.quote.text,
        writingMode: manifest.quote.writingMode ?? "vertical",
      }
    : null;

  return { ok: true, plan: { layers, quote }, errors: [] };
}
