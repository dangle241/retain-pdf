// Stage Planner: manifest(Unknown JSON) â render plan(Pure data).
//
// DecorStage Component consumes output only; no self-parsing. manifest handles validation/downgrade/paths
// All parsing contained in pure functions for easier node:test Direct test (no use jsdom Unmount component.
//
// Downgrade chain (contract docs/theme-system/DECOR_PACKS.md）：
// - model Layer on image stage. No WebGL/reduced-motion â render fallback Static graph
// - reduced-motion â Reset all parallax
// Contract: ./contract.ts Â· Anchor: ./slots.ts

import { validateDecorManifest } from "./contract.js";
import { getDecorSlot, type DecorLayerBand, type DecorSlotId } from "./slots.js";

export type StageLayerPlan = {
  key: string;
  slot: DecorSlotId;
  band: DecorLayerBand;
/** Joined. assetBase image URL (model layer on image stage = its fallback) */
  src: string;
  /** 0 = Static.reduced-motion Force 0） */
  parallax: number;
  opacity: number;
  /** Click layer to display quotes (image Layer optional; multi-sentence "\n\n" Separator) */
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
  /** Deco pack root URLNo trailing slash, e.g. "decor/jiangnan" */
  assetBase: string;
  /** prefers-reduced-motion：parallax Reset (image stage not rendered) 3D） */
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
    // Image stage:model All layers use static fallback image.three Route by capability after engine integration.
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
