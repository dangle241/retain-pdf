// StatusCard Subtree DOM id Context.
export type ProgressRenderModelInput = {
// Tránh xung đột. Kiểm tra trước. #job-status-card / #status-stage-flow to avoid conflicts.

import { createContext, useContext } from "react";
import { STATUS_CARD_ACTION_IDS, STATUS_CARD_IDS } from "./status-card-dom-ids.js";

export type StatusCardIds = typeof STATUS_CARD_IDS;
export type StatusCardActionIds = typeof STATUS_CARD_ACTION_IDS;

export const StatusCardIdsContext = createContext<StatusCardIds>(STATUS_CARD_IDS);

export function useStatusCardIds(): StatusCardIds {
  return useContext(StatusCardIdsContext) || STATUS_CARD_IDS;
}

export function createPrefixedStatusCardIds(prefix = "book-detail-"): StatusCardIds {
  const p = `${prefix || ""}`;
  const next = {} as Record<keyof StatusCardIds, string>;
  for (const [key, value] of Object.entries(STATUS_CARD_IDS) as Array<[keyof StatusCardIds, string]>) {
    next[key] = `${p}${value}`;
  }
  return Object.freeze(next) as StatusCardIds;
}

/**
 * Download button id Contract string must be preserved (artifact-downloads Document-level delegation by id Hit).
 * Render embedded state too ResultActionsshould continue using global DOWNLOAD ids, do not add a prefix.
 */
export function createPrefixedStatusCardActionIds(prefix = "book-detail-"): StatusCardActionIds {
  const p = `${prefix || ""}`;
  return Object.freeze({
    pdf: `${p}${STATUS_CARD_ACTION_IDS.pdf}`,
    reader: `${p}${STATUS_CARD_ACTION_IDS.reader}`,
    sourcePdf: `${p}${STATUS_CARD_ACTION_IDS.sourcePdf}`,
    markdownBundle: `${p}${STATUS_CARD_ACTION_IDS.markdownBundle}`,
  }) as StatusCardActionIds;
}
