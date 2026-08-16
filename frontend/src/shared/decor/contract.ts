// Hợp đồng manifest gói trang trí: kiểu + xác thực + nguồn sự thật về ngân sách tài nguyên.
//
// Một "chủ đề trang trí" = giao diện phối màu (themes/<id>.css, giữ nguyên hệ thống hiện có)
//                + gói trang trí (manifest.json + tài nguyên trong thư mục tĩnh public).
// ThemeDefinition.decorPack trong registry.ts trỏ tới tên gói; giao diện không có decorPack
// (classic/night, v.v.) không có trang trí và không tải thêm.
//
// Hợp đồng đi trước: file này là nguồn sự thật schema duy nhất của manifest. Engine sân khấu, pipeline tài nguyên
// và tiêu chí nghiệm thu mô hình do AI tạo chỉ công nhận kết quả của validateDecorManifest.
// Tài liệu thiết kế: docs/theme-system/DECOR_PACKS.md.

import { getDecorSlot, isDecorSlotId, type DecorSlotId } from "./slots.js";

export const DECOR_MANIFEST_VERSION = 1;

/* ---------- Ngân sách tài nguyên (nguồn sự thật dùng chung cho cổng pipeline và xác thực) ---------- */

/** Giới hạn dung lượng một mô hình glb (sau nén Draco+KTX2). */
export const MODEL_BUDGET_KB = 2048;
/** Giới hạn số tam giác của một mô hình (theo gltf-transform inspect). */
export const MODEL_MAX_TRIANGLES = 50_000;
/** Giới hạn dung lượng một ảnh trang trí (webp). */
export const IMAGE_BUDGET_KB = 512;
/** Giới hạn số lớp 3D mount đồng thời trên một canvas (vượt quá thì nên làm thành lớp ảnh). */
export const MAX_MODEL_LAYERS = 3;
/** Giới hạn tổng số lớp trong một gói (ngăn "dán kín màn hình" mất kiểm soát). */
export const MAX_LAYERS = 12;

/* ---------- Kiểu manifest ---------- */

export type DecorImageLayer = {
  type: "image";
  slot: DecorSlotId;
  /** Đường dẫn tương đối với thư mục gốc gói, ví dụ "dragon.webp"; cấm đường dẫn tuyệt đối / giao thức / "..". */
  src: string;
  /** Cường độ thị sai chuột 0~0.2 (0 hoặc bỏ trống = không chuyển động). */
  parallax?: number;
  /** 0~1, mặc định 1. */
  opacity?: number;
  /** Câu trích dẫn hiển thị khi bấm lớp (nhiều câu phân tách bằng "\n\n" để luân phiên; bỏ trống = không thể bấm). */
  clickQuote?: string;
};

export type DecorModelLayer = {
  type: "model";
  slot: DecorSlotId;
  /** .glb (đưa vào kho sau nén Draco/KTX2). */
  src: string;
  /** Ảnh tĩnh fallback (reduced-motion / không có WebGL / thiết bị yếu), bắt buộc. */
  fallback: string;
  /** Tên AnimationClip của hoạt ảnh chờ lặp (có sẵn trong glb). */
  idleClip?: string;
  /** Tên AnimationClip chạy một lần khi bấm. */
  clickClip?: string;
  parallax?: number;
};

export type DecorLayer = DecorImageLayer | DecorModelLayer;

/** Biểu ngữ đề chữ (ví dụ "Biết nơi mình đến, hiểu nơi mình đi"). */
export type DecorQuote = {
  slot: DecorSlotId;
  text: string;
  /** Mặc định vertical (xếp dọc). */
  writingMode?: "vertical" | "horizontal";
};

export type DecorManifest = {
  version: typeof DECOR_MANIFEST_VERSION;
  /** Tên gói, trùng tên thư mục, kebab-case. */
  id: string;
  layers: DecorLayer[];
  quote?: DecorQuote;
};

/* ---------- Xác thực ---------- */

export type DecorManifestValidation =
  | { ok: true; manifest: DecorManifest; errors: [] }
  | { ok: false; manifest: null; errors: string[] };

const PACK_ID_RE = /^[a-z][a-z0-9-]*$/;
const IMAGE_EXT_RE = /\.(webp|png|svg|avif)$/i;
const MODEL_EXT_RE = /\.glb$/i;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Đường dẫn tương đối và không thoát khỏi thư mục gói. */
function isSafeRelativePath(v: unknown): v is string {
  if (typeof v !== "string" || !v.trim()) return false;
  if (v.startsWith("/") || v.includes("..") || v.includes("\\")) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return false; // Các giao thức như http:, data:.
  return true;
}

function checkClipName(v: unknown, label: string, errors: string[]) {
  if (v === undefined) return;
  if (typeof v !== "string" || !v.trim()) {
    errors.push(`${label} phải là chuỗi không rỗng (tên AnimationClip trong glb)`);
  }
}

/**
 * Xác thực JSON chưa biết có phải manifest hợp lệ hay không.
 * Khi trả ok:false, từng lỗi trong errors phải dễ đọc để chuyển thẳng tới cổng pipeline/console.
 */
export function validateDecorManifest(input: unknown): DecorManifestValidation {
  const errors: string[] = [];
  if (!isPlainObject(input)) {
    return { ok: false, manifest: null, errors: ["manifest phải là một đối tượng JSON"] };
  }

  if (input.version !== DECOR_MANIFEST_VERSION) {
    errors.push(`version phải là ${DECOR_MANIFEST_VERSION}, đã nhận ${JSON.stringify(input.version)}`);
  }
  if (typeof input.id !== "string" || !PACK_ID_RE.test(input.id)) {
    errors.push(`id phải là tên gói dạng kebab-case, đã nhận ${JSON.stringify(input.id)}`);
  }

  const layers = input.layers;
  if (!Array.isArray(layers) || layers.length === 0) {
    errors.push("layers phải là một mảng không rỗng");
    return { ok: false, manifest: null, errors };
  }
  if (layers.length > MAX_LAYERS) {
    errors.push(`Số lượng layers ${layers.length} vượt quá giới hạn ${MAX_LAYERS}`);
  }

  const usedSlots = new Set<string>();
  let modelCount = 0;

  layers.forEach((raw, i) => {
    const at = `layers[${i}]`;
    if (!isPlainObject(raw)) {
      errors.push(`${at} phải là một đối tượng`);
      return;
    }
    const { type, slot } = raw;

    if (type !== "image" && type !== "model") {
      errors.push(`${at}.type phải là "image" | "model", đã nhận ${JSON.stringify(type)}`);
      return;
    }
    if (!isDecorSlotId(slot)) {
      errors.push(`${at}.slot ${JSON.stringify(slot)} không có trong registry slots.ts`);
      return;
    }
    // Một slot chỉ mount một lớp: muốn xếp chồng thì mở neo mới trong slots.ts, không chồng lớp trong manifest.
    if (usedSlots.has(slot)) {
      errors.push(`${at}.slot "${slot}" bị dùng trùng (mỗi slot chỉ gắn một lớp)`);
    }
    usedSlots.add(slot);

    if (!isSafeRelativePath(raw.src)) {
      errors.push(`${at}.src phải là đường dẫn tương đối trong gói (không cho phép đường dẫn tuyệt đối, giao thức hoặc ..)`);
    }

    if (raw.parallax !== undefined) {
      const p = raw.parallax;
      if (typeof p !== "number" || !(p >= 0 && p <= 0.2)) {
        errors.push(`${at}.parallax phải nằm trong [0, 0.2], đã nhận ${JSON.stringify(p)}`);
      }
    }

    if (type === "image") {
      if (typeof raw.src === "string" && !IMAGE_EXT_RE.test(raw.src)) {
        errors.push(`${at}.src cho ảnh chỉ chấp nhận webp/png/svg/avif`);
      }
      if (raw.opacity !== undefined) {
        const o = raw.opacity;
        if (typeof o !== "number" || !(o > 0 && o <= 1)) {
          errors.push(`${at}.opacity phải nằm trong (0, 1]`);
        }
      }
      if (raw.clickQuote !== undefined) {
        if (typeof raw.clickQuote !== "string" || !raw.clickQuote.trim()) {
          errors.push(`${at}.clickQuote phải là chuỗi không rỗng (nhiều câu phân tách bằng \\n\\n)`);
        }
      }
    } else {
      modelCount += 1;
      if (typeof raw.src === "string" && !MODEL_EXT_RE.test(raw.src)) {
        errors.push(`${at}.src cho mô hình chỉ chấp nhận .glb`);
      }
      if (!isSafeRelativePath(raw.fallback) || !IMAGE_EXT_RE.test(String(raw.fallback))) {
        errors.push(`${at}.fallback là bắt buộc và phải là đường dẫn ảnh trong gói (phương án dự phòng tĩnh cho mô hình)`);
      }
      checkClipName(raw.idleClip, `${at}.idleClip`, errors);
      checkClipName(raw.clickClip, `${at}.clickClip`, errors);
      const slotDef = getDecorSlot(slot);
      if (slotDef?.id === "backdrop") {
        errors.push(`${at}: slot nền không được gắn mô hình 3D (giới hạn hiệu năng; hãy dùng image + parallax)`);
      }
    }
  });

  if (modelCount > MAX_MODEL_LAYERS) {
    errors.push(`Có ${modelCount} lớp 3D, vượt quá giới hạn ${MAX_MODEL_LAYERS} (hãy kết xuất các lớp dư thành lớp ảnh)`);
  }

  const quote = input.quote;
  if (quote !== undefined) {
    if (!isPlainObject(quote)) {
      errors.push("quote phải là một đối tượng");
    } else {
      if (!isDecorSlotId(quote.slot)) {
        errors.push(`quote.slot ${JSON.stringify(quote.slot)} không có trong registry`);
      } else if (!getDecorSlot(quote.slot)?.textCapable) {
        errors.push(`quote.slot "${quote.slot}" không hỗ trợ văn bản (cần điểm neo textCapable)`);
      }
      if (typeof quote.text !== "string" || !quote.text.trim()) {
        errors.push("quote.text phải là chuỗi không rỗng");
      }
      if (quote.writingMode !== undefined && quote.writingMode !== "vertical" && quote.writingMode !== "horizontal") {
        errors.push('quote.writingMode phải là "vertical" | "horizontal"');
      }
    }
  }

  if (errors.length > 0) return { ok: false, manifest: null, errors };
  return { ok: true, manifest: input as unknown as DecorManifest, errors: [] };
}
