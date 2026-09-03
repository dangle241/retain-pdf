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
    return current > 0 ? `Progress ${current}%` : "Processing";
  }
  if (stageInfo.key === "render" && subtype === "render_compile") {
    return current >= total ? "Rendering complete" : "Compiling PDF";
  }
  if (stageInfo.key === "render" && subtype === "render_prewarm") {
    return `Prewarm ${current}/${total}`;
  }
  if (stageInfo.key === "render" && subtype === "render_prepare") {
    return `Preparing ${current}/${total}`;
  }
  if (progressUnit === "page") {
    if (stageInfo.key === "ocr" && current <= 0) {
      return `OCR Processing, total ${total} pages`;
    }
    if (stageInfo.key === "render" && current <= 0) {
      return `Rendering, total ${total} pages`;
    }
    if (stageInfo.key === "render" && current >= total) {
      return `Rendering complete, total ${total} pages`;
    }
    return `Page ${current}/${total} pages`;
  }
  if (progressUnit === "batch") {
    return `Page ${current}/${total} batches`;
  }
  if (progressUnit === "step") {
    if (stageInfo.key === "render") {
      return `Preparing ${current}/${total}`;
    }
    return `Progress ${current}/${total}`;
  }
  if (subtype === "continuation_review" || subtype === "page_policies") {
    return `Page ${current}/${total} pages`;
  }
  if (subtype === "domain_inference" || subtype === "translation_prepare") {
    return `Progress ${current}/${total}`;
  }
  if (stageInfo.key === "translate") {
    return `Page ${current}/${total} batches`;
  }
  if (stageInfo.key === "ocr") {
    if (looksLikeProviderPercentProgress(current, total)) {
      return current > 0 ? `OCR ${current}%` : "OCR Processing";
    }
    return `Page ${current}/${total} pages`;
  }
  if (stageInfo.key === "render") {
    return `Page ${current}/${total} pages`;
  }
  return `Progress ${current}/${total}`;
}




