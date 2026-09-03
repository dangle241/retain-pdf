// Stage planner: manifest (unknown JSON) → rendering plan (pure data).
//
// DecorStage consumes only this output, never parses manifest itself — validation,
// fallback, and path resolution are kept in pure functions so node:test can run
// them without jsdom.
//
// Fallback chain (see docs/theme-system/DECOR_PACKS.md):
// - model layer under image‑based stage / no WebGL / reduced‑motion → static fallback image
// - reduced‑motion → all parallax zeroed out
// Contract: ./contract.ts · Slots: ./slots.ts

import { validateDecorManifest } from "./contract.js";
import { getDecorSlot, type DecorLayerBand, type DecorSlotId } from "./slots.js";

export type StageLayerPlan = {
  key: string;
  slot: DecorSlotId;
  band: DecorLayerBand;
  /** Image URL with assetBase already prepended (for model layers this is the fallback) */
  src: string;
  /** 0 = no movement (forced to 0 under reduced‑motion) */
  parallax: number;
  opacity: number;
  /** Quote shown on layer click (image layer optional; multiple quotes separated by "\n\n") */
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
  /** Decor pack root URL (no trailing slash), e.g. "decor/jiangnan" */
  assetBase: string;
  /** prefers‑reduced‑motion: zero parallax (and image‑based stage won't render 3D) */
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
    // Image‑based stage: model layers always use static fallback images (three engine will stream later as capability allows)
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



