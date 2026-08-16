import {
  looksLikeProviderPercentProgress,
} from "./job-status-summary-helpers.js";
import { stageKeyOf, stageSubtypeOf, userStageFor } from "./job-status-summary-stage.js";
import {
  publicProgressOf,
} from "./job-stage-progress-adapter.js";

export function summarizeStageProgressText(payload) {
  const progress = publicProgressOf(payload);
  const stage = userStageFor(payload);
  return progressTextForStageProgress({
    stageKey: stageKeyOf(payload),
    substageKey: stageSubtypeOf(payload),
    stage,
    progress,
  });
}

export function progressTextForStageProgress({
  stageKey = "",
  substageKey = "",
  stage = null,
  progress = {},
}: any = {}) {
  const current = progress.current;
  const total = progress.total;
  if (current === null || total === null || total <= 0) {
    return "";
  }
  const subtype = substageKey;
  const stageInfo = stage || { key: stageKey };
  const progressUnit = progress.unit || "";
  if (progressUnit === "percent") {
    return current > 0 ? `Tiến độ ${current}%` : "Đang xử lý";
  }
  if (stageInfo.key === "render" && subtype === "render_compile") {
    return current >= total ? "Kết xuất hoàn tất" : "Đang biên dịch PDF";
  }
  if (stageInfo.key === "render" && subtype === "render_prewarm") {
    return `Khởi động trước ${current}/${total}`;
  }
  if (stageInfo.key === "render" && subtype === "render_prepare") {
    return `Chuẩn bị ${current}/${total}`;
  }
  if (progressUnit === "page") {
    if (stageInfo.key === "ocr" && current <= 0) {
      return `Đang xử lý OCR, tổng cộng ${total} trang`;
    }
    if (stageInfo.key === "render" && current <= 0) {
      return `Đang kết xuất, tổng cộng ${total} trang`;
    }
    if (stageInfo.key === "render" && current >= total) {
      return `Kết xuất hoàn tất, tổng cộng ${total} trang`;
    }
    return `Trang ${current}/${total}`;
  }
  if (progressUnit === "batch") {
    return `Đợt ${current}/${total}`;
  }
  if (progressUnit === "step") {
    if (stageInfo.key === "render") {
      return `Chuẩn bị ${current}/${total}`;
    }
    return `Tiến độ ${current}/${total}`;
  }
  if (subtype === "continuation_review" || subtype === "page_policies") {
    return `Trang ${current}/${total}`;
  }
  if (subtype === "domain_inference" || subtype === "translation_prepare") {
    return `Tiến độ ${current}/${total}`;
  }
  if (stageInfo.key === "translate") {
    return `Đợt ${current}/${total}`;
  }
  if (stageInfo.key === "ocr") {
    if (looksLikeProviderPercentProgress(current, total)) {
      return current > 0 ? `OCR ${current}%` : "Đang xử lý OCR";
    }
    return `Trang ${current}/${total}`;
  }
  if (stageInfo.key === "render") {
    return `Trang ${current}/${total}`;
  }
  return `Tiến độ ${current}/${total}`;
}
