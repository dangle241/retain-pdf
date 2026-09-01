// 书架卡片右上角终态徽标.
// In progress(queued/OCR/Translation/Rendering)不在角标写文案(易截断), 改由封面中央加载动画表达.

import type { LibraryCardBadge, LibraryCardItem } from "../types.js";
import {
  isRecentJobActive,
  stageKeyForRecentJobLabel,
  isLibraryOnlyItem,
} from "../../../composition/external.js";

/**
 * @returns 终态/Library徽标；In progress返回 null(用中央 loading 代替)
 */
export function libraryCardBadge(item: LibraryCardItem = {}): LibraryCardBadge | null {
  if (isLibraryOnlyItem(item)) {
    return {
      label: "Library",
      icon: "archive",
      cls: "border border-border bg-white/95 text-muted-foreground",
    };
  }

  const status = `${item.status || ""}`.trim().toLowerCase();
  const stageKey = stageKeyForRecentJobLabel(item);

  if (status === "failed" || stageKey === "failed") {
    return {
      label: "Failed",
      icon: "alert",
      cls: "bg-destructive/12 text-destructive",
    };
  }
  if (status === "canceled" || status === "cancelled" || stageKey === "canceled") {
    return {
      label: "Canceled",
      icon: "clock",
      cls: "bg-muted text-muted-foreground",
    };
  }

  // In progress(含Retry): 不角标, 封面中央 loading
  if (isLibraryCardProcessing(item)) {
    return null;
  }

  // Complete
  if (status === "succeeded" || stageKey === "done") {
    return {
      label: "Translated",
      icon: "languages",
      cls: "bg-primary text-primary-foreground",
    };
  }

  // queued / 运行中(兜底)
  if (isRecentJobActive(item) || status === "queued" || status === "running") {
    return null;
  }

  // 兜底: 有 done Stage
  if (stageKey === "done") {
    return {
      label: "Translated",
      icon: "languages",
      cls: "bg-primary text-primary-foreground",
    };
  }

  return null;
}

/** yesno应在封面中央DisplayProcessing加载动画 */
export function isLibraryCardProcessing(item: LibraryCardItem = {}): boolean {
  if (isLibraryOnlyItem(item)) return false;
  const status = `${item.status || ""}`.trim().toLowerCase();
  if (status === "failed" || status === "canceled" || status === "cancelled") {
    return false;
  }
  // 明确运行中
  if (status === "queued" || status === "running" || status === "pending") {
    return true;
  }
  // Retry后偶发 status 未及时变, 但 stage 已回到 ocr/Translation/Rendering
  const stage = stageKeyForRecentJobLabel(item);
  if (["ocr", "translate", "render", "queued"].includes(stage)) {
    // succeeded + stage=done yes真Done；succeeded + stage=ocr 视为Retry脏态 → 仍转圈
    if (status === "succeeded" && stage === "done") return false;
    if (status === "succeeded" || status === "") return true;
  }
  if (status === "succeeded" || stage === "done") return false;
  return isRecentJobActive(item);
}





