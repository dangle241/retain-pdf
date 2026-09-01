// Decoration pack manifest contract: type + validation + asset budget ground truth.
//
// A "Theme decoration" = Color skin (themes/<id>.css, existing system remains unchanged)
//                + Decoration pack (public static directory: manifest.json + assets).
// registry.ts ThemeDefinition.decorPack points to package name; if none, no decorPack
// Skin (classic/night etc.) Zero decoration, zero extra downloads.
//
// Contract-first: this file is manifest unique schema Truth value. Stage engine, asset pipeline
// Gatekeeping and AI production model acceptance criteria only recognize validateDecorManifest conclusion.
// Design document:docs/theme-system/DECOR_PACKS.md

import { getDecorSlot, isDecorSlotId, type DecorSlotId } from "./slots.js";

export const DECOR_MANIFEST_VERSION = 1;

/* ---------- Asset budget (source of truth for pipeline gates and validation) ---------- */

/** Single glb model size limit (Draco+KTX2 after compression) */
export const MODEL_BUDGET_KB = 2048;
/** Single model triangle face limit (gltf-transform inspect Caliber */
export const MODEL_MAX_TRIANGLES = 50_000;
/** Max size single decorative image (webp） */
export const IMAGE_BUDGET_KB = 512;
/** Mounted simultaneously on single canvas 3D Layer limit (exceeding this requires converting to an image layer) */
export const MAX_MODEL_LAYERS = 3;
/** Max layer count per bundle (prevent"filling the screen"Out of control) */
export const MAX_LAYERS = 12;

/* ---------- manifest Type ---------- */

export type DecorImageLayer = {
  type: "image";
  slot: DecorSlotId;
/** Path relative to package root, e.g. "dragon.webp". Absolute paths, protocols, or ".." are forbidden. */
  src: string;
  /** Mouse parallax intensity 0~0.2（0 or default = Static. */
  parallax?: number;
  /** 0~1Default 1 */
  opacity?: number;
  /** Quotes displayed on layer click (use "\n\n" Carousel separator; default = Unclickable */
  clickQuote?: string;
};

export type DecorModelLayer = {
  type: "model";
  slot: DecorSlotId;
  /** .glb（Draco/KTX2 Store after compression */
  src: string;
/** Static graph fallback (reduced-motion / no WebGL / required for low-end devices) */
  fallback: string;
  /** Looping idle animation AnimationClip First name (glb built-in */
  idleClip?: string;
/** One-time trigger on click AnimationClip name */
  clickClip?: string;
  parallax?: number;
};

export type DecorLayer = DecorImageLayer | DecorModelLayer;

/** Inscription banner (e.g."Know its origin. Indicate destination."） */
export type DecorQuote = {
  slot: DecorSlotId;
  text: string;
/** Default is vertical. */
  writingMode?: "vertical" | "horizontal";
};

export type DecorManifest = {
  version: typeof DECOR_MANIFEST_VERSION;
  /** Package name matches directory name.kebab-case */
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

/** Relative path, no escape from package directory */
function isSafeRelativePath(v: unknown): v is string {
  if (typeof v !== "string" || !v.trim()) return false;
  if (v.startsWith("/") || v.includes("..") || v.includes("\\")) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return false; // http:, data: Awaiting protocol
  return true;
}

function checkClipName(v: unknown, label: string, errors: string[]) {
  if (v === undefined) return;
  if (typeof v !== "string" || !v.trim()) {
    errors.push(`${label} Must be a non-empty string (glb within AnimationClip Name)`);
  }
}

/**
 * Validation unknown JSON Is valid manifest。
* When returning ok:false, errors are readable per line. Pass directly to pipeline gate/console.
 */
export function validateDecorManifest(input: unknown): DecorManifestValidation {
  const errors: string[] = [];
  if (!isPlainObject(input)) {
    return { ok: false, manifest: null, errors: ["manifest must be JSON Object"] };
  }

  if (input.version !== DECOR_MANIFEST_VERSION) {
    errors.push(`version Must be ${DECOR_MANIFEST_VERSION}, received ${JSON.stringify(input.version)}`);
  }
  if (typeof input.id !== "string" || !PACK_ID_RE.test(input.id)) {
errors.push(`id must be a kebab-case package name, received ${JSON.stringify(input.id)}`);
  }

  const layers = input.layers;
  if (!Array.isArray(layers) || layers.length === 0) {
    errors.push("layers Non-empty array required.");
    return { ok: false, manifest: null, errors };
  }
  if (layers.length > MAX_LAYERS) {
    errors.push(`layers Quantity ${layers.length} Exceeds limit. ${MAX_LAYERS}`);
  }

  const usedSlots = new Set<string>();
  let modelCount = 0;

  layers.forEach((raw, i) => {
    const at = `layers[${i}]`;
    if (!isPlainObject(raw)) {
      errors.push(`${at} Must be an object.`);
      return;
    }
    const { type, slot } = raw;

    if (type !== "image" && type !== "model") {
errors.push(`${at}.type must be "image" | "model", received ${JSON.stringify(type)}`);
      return;
    }
    if (!isDecorSlotId(slot)) {
errors.push(`${at}.slot ${JSON.stringify(slot)} is not in the slots.ts registry.`);
      return;
    }
// One slot per layer only: for stacking, open a new anchor in slots.ts; do not stack in manifest.
    if (usedSlots.has(slot)) {
      errors.push(`${at}.slot "${slot}" Already occupied (one slot Only one layer)`);
    }
    usedSlots.add(slot);

    if (!isSafeRelativePath(raw.src)) {
errors.push(`${at}.src must be a package-relative path (absolute paths, protocols, or ".." forbidden)`);
    }

    if (raw.parallax !== undefined) {
      const p = raw.parallax;
      if (typeof p !== "number" || !(p >= 0 && p <= 0.2)) {
errors.push(`${at}.parallax must be in [0, 0.2], received ${JSON.stringify(p)}`);
      }
    }

    if (type === "image") {
      if (typeof raw.src === "string" && !IMAGE_EXT_RE.test(raw.src)) {
        errors.push(`${at}.src Images only. webp/png/svg/avif`);
      }
      if (raw.opacity !== undefined) {
        const o = raw.opacity;
        if (typeof o !== "number" || !(o > 0 && o <= 1)) {
errors.push(`${at}.opacity must be in (0, 1]`);
        }
      }
      if (raw.clickQuote !== undefined) {
        if (typeof raw.clickQuote !== "string" || !raw.clickQuote.trim()) {
          errors.push(`${at}.clickQuote Must be a non-empty string (use multiple sentences with \\n\\n Separator)`);
        }
      }
    } else {
      modelCount += 1;
      if (typeof raw.src === "string" && !MODEL_EXT_RE.test(raw.src)) {
        errors.push(`${at}.src Model accepts only .glb`);
      }
      if (!isSafeRelativePath(raw.fallback) || !IMAGE_EXT_RE.test(String(raw.fallback))) {
        errors.push(`${at}.fallback Required. Must be in-package image path (static fallback for model).`);
      }
      checkClipName(raw.idleClip, `${at}.idleClip`, errors);
      checkClipName(raw.clickClip, `${at}.clickClip`, errors);
      const slotDef = getDecorSlot(slot);
      if (slotDef?.id === "backdrop") {
errors.push(`${at} backdrop slot cannot hold 3D models (performance red line, use image + parallax)`);
      }
    }
  });

  if (modelCount > MAX_MODEL_LAYERS) {
errors.push(`3D layers ${modelCount} exceed limit. ${MAX_MODEL_LAYERS}. Bake excess into image layer.`);
  }

  const quote = input.quote;
  if (quote !== undefined) {
    if (!isPlainObject(quote)) {
errors.push("quote must be an object");
    } else {
      if (!isDecorSlotId(quote.slot)) {
        errors.push(`quote.slot ${JSON.stringify(quote.slot)} Not in registry.`);
      } else if (!getDecorSlot(quote.slot)?.textCapable) {
        errors.push(`quote.slot "${quote.slot}" Text not supported (requires textCapable anchor)`);
      }
      if (typeof quote.text !== "string" || !quote.text.trim()) {
        errors.push("quote.text Must be a non-empty string.");
      }
      if (quote.writingMode !== undefined && quote.writingMode !== "vertical" && quote.writingMode !== "horizontal") {
errors.push('quote.writingMode must be "vertical" | "horizontal"');
      }
    }
  }

  if (errors.length > 0) return { ok: false, manifest: null, errors };
  return { ok: true, manifest: input as unknown as DecorManifest, errors: [] };
}
