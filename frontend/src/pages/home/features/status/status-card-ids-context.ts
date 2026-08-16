// Ngữ cảnh ID DOM của cây con StatusCard.
// StatusCard của luồng chính dùng ID hợp đồng toàn cục (smoke phụ thuộc); trạng thái nhúng như chi tiết sách dùng ID có tiền tố
// để tránh xung đột với #job-status-card / #status-stage-flow và các ID khác.

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
 * ID nút tải xuống phải giữ nguyên chuỗi hợp đồng (ủy quyền cấp document của artifact-downloads khớp theo ID).
 * Nếu trạng thái nhúng cũng render ResultActions, tiếp tục dùng ID DOWNLOAD toàn cục, không thêm tiền tố.
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
