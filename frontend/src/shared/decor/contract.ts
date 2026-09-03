// Decor pack manifest contract: type definitions, validation, and asset budgets.
//
// A "decor theme" = color skin (themes/<id>.css, existing system untouched)
//                + decor pack (manifest.json + assets under public static dir).
// registry.ts ThemeDefinition.decorPack points to the pack name; packs without
// decorPack (classic/night etc.) have zero decor, zero extra downloads.
//
// Contract first: this file is the single source of truth for manifest schema.
// Stage engine, asset pipeline, and AI model acceptance all rely solely on
// validateDecorManifest's conclusion.
// Design doc: docs/theme-system/DECOR_PACKS.md

import { getDecorSlot, isDecorSlotId, type DecorSlotId } from "./slots.js";

export const DECOR_MANIFEST_VERSION = 1;

/* ---------- Asset budgets (ground truth for pipeline gates and validation) ---------- */

/** Max size per glb model (after Draco+KTX2 compression) */
export const MODEL_BUDGET_KB = 2048;
/** Max triangles per model (as reported by gltf-transform inspect) */
export const MODEL_MAX_TRIANGLES = 50_000;
/** Max size per decor image (webp) */
export const IMAGE_BUDGET_KB = 512;
/** Max 3D layers mounted simultaneously on one canvas (exceed → bake to image layer) */
export const MAX_MODEL_LAYERS = 3;
/** Max layers per pack (prevent "wallpapering" the screen) */
export const MAX_LAYERS = 12;

/* ---------- manifest Type ---------- */

export type DecorImageLayer = {
  type: "image";
  slot: DecorSlotId;
  /** Path relative to pack root, e.g. "dragon.webp"; no absolute paths / protocols / ".." */
  src: string;
  /** Mouse parallax strength 0–0.2 (0 or omitted = no movement) */
  parallax?: number;
  /** 0–1, default 1 */
  opacity?: number;
  /** Quote shown when layer is clicked (multiple quotes separated by "\n\n" for rotation; omitted = not clickable) */
  clickQuote?: string;
};

export type DecorModelLayer = {
  type: "model";
  slot: DecorSlotId;
  /** .glb (with Draco/KTX2 compression applied) */
  src: string;
  /** Static image fallback (for reduced‑motion / no WebGL / low‑end devices), required */
  fallback: string;
  /** Name of looping idle animation clip (built into glb) */
  idleClip?: string;
  /** Name of one‑shot click animation clip */
  clickClip?: string;
  parallax?: number;
};

export type DecorLayer = DecorImageLayer | DecorModelLayer;

/** Inscription banner (e.g. "知其所来 明其所往") */
export type DecorQuote = {
  slot: DecorSlotId;
  text: string;
  /** Default 'vertical' */
  writingMode?: "vertical" | "horizontal";
};

export type DecorManifest = {
  version: typeof DECOR_MANIFEST_VERSION;
  /** Pack name, matches directory name, kebab‑case */
  id: string;
  layers: DecorLayer[];
  quote?: DecorQuote;
};

/* ---------- Validation ---------- */

export type DecorManifestValidation =
  | { ok: true; manifest: DecorManifest; errors: [] }
  | { ok: false; manifest: null; errors: string[] };

const PACK_ID_RE = /^[a-z][a-z0-9-]*$/;
const IMAGE_EXT_RE = /\.(webp|png|svg|avif)$/i;
const MODEL_EXT_RE = /\.glb$/i;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Relative path that does not escape the pack directory */
function isSafeRelativePath(v: unknown): v is string {
  if (typeof v !== "string" || !v.trim()) return false;
  if (v.startsWith("/") || v.includes("..") || v.includes("\\")) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return false; // http:, data:, etc.
  return true;
}

function checkClipName(v: unknown, label: string, errors: string[]) {
  if (v === undefined) return;
  if (typeof v !== "string" || !v.trim()) {
    errors.push(`${label} must be a non‑empty string (AnimationClip name inside glb)`);
  }
}

/**
 * Validate unknown JSON as a valid manifest.
 * When ok:false, errors are readable and passed directly to pipeline gates/console.
 */
export function validateDecorManifest(input: unknown): DecorManifestValidation {
  const errors: string[] = [];
  if (!isPlainObject(input)) {
    return { ok: false, manifest: null, errors: ["manifest must be a JSON object"] };
  }

  if (input.version !== DECOR_MANIFEST_VERSION) {
    errors.push(`version must be ${DECOR_MANIFEST_VERSION}, got ${JSON.stringify(input.version)}`);
  }
  if (typeof input.id !== "string" || !PACK_ID_RE.test(input.id)) {
    errors.push(`id must be a kebab‑case pack name, got ${JSON.stringify(input.id)}`);
  }

  const layers = input.layers;
  if (!Array.isArray(layers) || layers.length === 0) {
    errors.push("layers must be a non‑empty array");
    return { ok: false, manifest: null, errors };
  }
  if (layers.length > MAX_LAYERS) {
    errors.push(`layers count ${layers.length} exceeds limit ${MAX_LAYERS}`);
  }

  const usedSlots = new Set<string>();
  let modelCount = 0;

  layers.forEach((raw, i) => {
    const at = `layers[${i}]`;
    if (!isPlainObject(raw)) {
      errors.push(`${at} must be an object`);
      return;
    }
    const { type, slot } = raw;

    if (type !== "image" && type !== "model") {
      errors.push(`${at}.type must be "image" | "model", got ${JSON.stringify(type)}`);
      return;
    }
    if (!isDecorSlotId(slot)) {
      errors.push(`${at}.slot ${JSON.stringify(slot)} not in slots.ts registry`);
      return;
    }
    // One slot, one layer: to stack, add a new slot in slots.ts, don't pile layers in manifest
    if (usedSlots.has(slot)) {
      errors.push(`${at}.slot "${slot}" is already occupied (one slot, one layer)`);
    }
    usedSlots.add(slot);

    if (!isSafeRelativePath(raw.src)) {
      errors.push(`${at}.src must be a relative path inside the pack (no absolute paths, protocols, or ..)`);
    }

    if (raw.parallax !== undefined) {
      const p = raw.parallax;
      if (typeof p !== "number" || !(p >= 0 && p <= 0.2)) {
        errors.push(`${at}.parallax must be in [0, 0.2], got ${JSON.stringify(p)}`);
      }
    }

    if (type === "image") {
      if (typeof raw.src === "string" && !IMAGE_EXT_RE.test(raw.src)) {
        errors.push(`${at}.src image only accepts webp/png/svg/avif`);
      }
      if (raw.opacity !== undefined) {
        const o = raw.opacity;
        if (typeof o !== "number" || !(o > 0 && o <= 1)) {
          errors.push(`${at}.opacity must be in (0, 1]`);
        }
      }
      if (raw.clickQuote !== undefined) {
        if (typeof raw.clickQuote !== "string" || !raw.clickQuote.trim()) {
          errors.push(`${at}.clickQuote must be a non‑empty string (use \\n\\n to separate multiple quotes)`);
        }
      }
    } else {
      modelCount += 1;
      if (typeof raw.src === "string" && !MODEL_EXT_RE.test(raw.src)) {
        errors.push(`${at}.src model only accepts .glb`);
      }
      if (!isSafeRelativePath(raw.fallback) || !IMAGE_EXT_RE.test(String(raw.fallback))) {
        errors.push(`${at}.fallback is required and must be an image path inside the pack (static fallback for model)`);
      }
      checkClipName(raw.idleClip, `${at}.idleClip`, errors);
      checkClipName(raw.clickClip, `${at}.clickClip`, errors);
      const slotDef = getDecorSlot(slot);
      if (slotDef?.id === "backdrop") {
        errors.push(`${at} backdrop slot cannot host 3D models (performance limit, use image + parallax)`);
      }
    }
  });

  if (modelCount > MAX_MODEL_LAYERS) {
    errors.push(`3D layers: ${modelCount}, exceeds limit ${MAX_MODEL_LAYERS} (bake the rest to image layers)`);
  }

  const quote = input.quote;
  if (quote !== undefined) {
    if (!isPlainObject(quote)) {
      errors.push("quote must be an object");
    } else {
      if (!isDecorSlotId(quote.slot)) {
        errors.push(`quote.slot ${JSON.stringify(quote.slot)} not in registry`);
      } else if (!getDecorSlot(quote.slot)?.textCapable) {
        errors.push(`quote.slot "${quote.slot}" does not support text (needs a textCapable slot)`);
      }
      if (typeof quote.text !== "string" || !quote.text.trim()) {
        errors.push("quote.text must be a non‑empty string");
      }
      if (quote.writingMode !== undefined && quote.writingMode !== "vertical" && quote.writingMode !== "horizontal") {
        errors.push('quote.writingMode must be "vertical" | "horizontal"');
      }
    }
  }

  if (errors.length > 0) return { ok: false, manifest: null, errors };
  return { ok: true, manifest: input as unknown as DecorManifest, errors: [] };
}





