// 书架卡片右上角终态徽标。
// 进行中（排队/OCR/翻译/渲染）不在角标写文案（易截断），改由封面中央加载动画表达。

import type { LibraryCardBadge, LibraryCardItem } from "../types.js";
import {
  isRecentJobActive,
  stageKeyForRecentJobLabel,
  isLibraryOnlyItem,
} from "../../../composition/external.js";

/**
 * @returns 终态/馆藏徽标；进行中返回 null（用中央 loading 代替）
 */
export function libraryCardBadge(item: LibraryCardItem = {}): LibraryCardBadge | null {
  if (isLibraryOnlyItem(item)) {
    return {
      label: "馆藏",
      icon: "archive",
      cls: "border border-border bg-white/95 text-muted-foreground",
    };
  }

  const status = `${item.status || ""}`.trim().toLowerCase();
  const stageKey = stageKeyForRecentJobLabel(item);

  if (status === "failed" || stageKey === "failed") {
    return {
      label: "失败",
      icon: "alert",
      cls: "bg-destructive/12 text-destructive",
    };
  }
  if (status === "canceled" || status === "cancelled" || stageKey === "canceled") {
    return {
      label: "已取消",
      icon: "clock",
      cls: "bg-muted text-muted-foreground",
    };
  }

  // 进行中（含重试）：不角标，封面中央 loading
  if (isLibraryCardProcessing(item)) {
    return null;
  }

  // 已完成
  if (status === "succeeded" || stageKey === "done") {
    return {
      label: "已翻译",
      icon: "languages",
      cls: "bg-primary text-primary-foreground",
    };
  }

  // 排队 / 运行中（兜底）
  if (isRecentJobActive(item) || status === "queued" || status === "running") {
    return null;
  }

  // 兜底：有 done 阶段
  if (stageKey === "done") {
    return {
      label: "已翻译",
      icon: "languages",
      cls: "bg-primary text-primary-foreground",
    };
  }

  return null;
}

/** 是否应在封面中央显示处理中加载动画 */
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
  // 重试后偶发 status 未及时变、但 stage 已回到 ocr/翻译/渲染
  const stage = stageKeyForRecentJobLabel(item);
  if (["ocr", "translate", "render", "queued"].includes(stage)) {
    // succeeded + stage=done 是真完成；succeeded + stage=ocr 视为重试脏态 → 仍转圈
    if (status === "succeeded" && stage === "done") return false;
    if (status === "succeeded" || status === "") return true;
  }
  if (status === "succeeded" || stage === "done") return false;
  return isRecentJobActive(item);
}
