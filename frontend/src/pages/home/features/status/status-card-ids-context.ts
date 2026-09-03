// StatusCard subtree DOM id context.
// Main workflow StatusCard uses global contract ids (smoke relies on them); Book Details and other
// embedded contexts use prefixed ids to avoid conflicts with #job-status-card / #status-stage-flow etc.

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
 * Download button ids must keep the contract strings (artifact-downloads Documents-level
 * delegation matches by id). Embedded contexts rendering ResultActions should continue
 * using global DOWNLOAD ids, no prefix.
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

