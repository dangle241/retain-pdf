// Final state badge, top-right corner of bookshelf card.
// In Progress (Queued)/OCR/Translation/Render: move text from badge (truncation risk) to center cover loading animation.

import type { LibraryCardBadge, LibraryCardItem } from "../types.js";
import {
  isRecentJobActive,
  stageKeyForRecentJobLabel,
  isLibraryOnlyItem,
} from "../../../composition/external.js";

/**
* @returns Final state/Collection badge; if in progress, return null (use central loading replacement)
 */
export function libraryCardBadge(item: LibraryCardItem = {}): LibraryCardBadge | null {
  if (isLibraryOnlyItem(item)) {
    return {
label: "Holdings",
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

  // In progress (including retries): no superscript, center of cover loading
  if (isLibraryCardProcessing(item)) {
    return null;
  }

// Completed
  if (status === "succeeded" || stageKey === "done") {
    return {
label: "Translated",
      icon: "languages",
      cls: "bg-primary text-primary-foreground",
    };
  }

// Queued / Running (fallback)
  if (isRecentJobActive(item) || status === "queued" || status === "running") {
    return null;
  }

// Fallback: present done stage
  if (stageKey === "done") {
    return {
label: "Translated",
      icon: "languages",
      cls: "bg-primary text-primary-foreground",
    };
  }

  return null;
}

/** Should the processing loading animation be displayed in the center of the cover? */
export function isLibraryCardProcessing(item: LibraryCardItem = {}): boolean {
  if (isLibraryOnlyItem(item)) return false;
  const status = `${item.status || ""}`.trim().toLowerCase();
  if (status === "failed" || status === "canceled" || status === "cancelled") {
    return false;
  }
  // Running
  if (status === "queued" || status === "running" || status === "pending") {
    return true;
  }
// occasionally after retry status is not updated in time, but stage returned ocr/translation/render
  const stage = stageKeyForRecentJobLabel(item);
  if (["ocr", "translate", "render", "queued"].includes(stage)) {
    // succeeded + stage=done Actually complete;succeeded + stage=ocr treated as retry dirty state → Spinner stuck. Check async handler. Ensure loading state resets on error/complete.
    if (status === "succeeded" && stage === "done") return false;
    if (status === "succeeded" || status === "") return true;
  }
  if (status === "succeeded" || stage === "done") return false;
  return isRecentJobActive(item);
}
