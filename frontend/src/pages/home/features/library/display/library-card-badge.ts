// Terminal-state badge in the top-right corner of bookshelf card.
// In progress (queued/OCR/Translation/Rendering) does not write process text in corner badge (easily truncated), instead show loading animation in cover center.

import type { LibraryCardBadge, LibraryCardItem } from "../types.js";
import {
  isRecentJobActive,
  stageKeyForRecentJobLabel,
  isLibraryOnlyItem,
} from "../../../composition/external.js";

/**
 * @returns Terminal/Library badge; returns null for in-progress (use center loading instead)
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

  // In progress (including Retry): no corner badge, center loading on cover
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

  // queued / running (fallback)
  if (isRecentJobActive(item) || status === "queued" || status === "running") {
    return null;
  }

  // Fallback: has done Stage
  if (stageKey === "done") {
    return {
      label: "Translated",
      icon: "languages",
      cls: "bg-primary text-primary-foreground",
    };
  }

  return null;
}

/** Whether to show the processing loading animation in the cover center */
export function isLibraryCardProcessing(item: LibraryCardItem = {}): boolean {
  if (isLibraryOnlyItem(item)) return false;
  const status = `${item.status || ""}`.trim().toLowerCase();
  if (status === "failed" || status === "canceled" || status === "cancelled") {
    return false;
  }
  // Explicitly running
  if (status === "queued" || status === "running" || status === "pending") {
    return true;
  }
  // After Retry: status may not update in time, but stage has already returned to ocr/translate/render
  const stage = stageKeyForRecentJobLabel(item);
  if (["ocr", "translate", "render", "queued"].includes(stage)) {
    // succeeded + stage=done is truly done; succeeded + stage=ocr treated as Retry dirty state → still spin
    if (status === "succeeded" && stage === "done") return false;
    if (status === "succeeded" || status === "") return true;
  }
  if (status === "succeeded" || stage === "done") return false;
  return isRecentJobActive(item);
}





