// BookCard「翻译」动作 —— 独立模块，改翻译入口只动本文件。
//
// 默认不上卡片；由调用方显式 concat。
// 展示条件：馆藏未翻译 或 job 失败，且有 document_id + onTranslate。

import type { BookCardAction, BookCardActionHandlers, LibraryCardItem } from "../types.js";
import { isLibraryOnlyItem } from "../../../composition/external.js";

export const BOOK_CARD_ACTION_TRANSLATE = "translate";

/**
 * @param item 书架 item
 * @param handlers onTranslate
 * @returns 0 或 1 个 action
 */
export function buildTranslateBookCardAction(
  item: LibraryCardItem = {},
  { onTranslate }: BookCardActionHandlers = {},
): BookCardAction[] {
  const documentId = `${item.document_id || ""}`.trim();
  if (!documentId || !onTranslate) {
    return [];
  }
  const canTranslate =
    isLibraryOnlyItem(item) || `${item.status || ""}`.trim() === "failed";
  if (!canTranslate) {
    return [];
  }

  return [{
    id: BOOK_CARD_ACTION_TRANSLATE,
    label: "翻译",
    icon: "languages",
    className: "book-card-action book-card-action-translate",
    onClick: (_event, current) => {
      onTranslate?.(current);
    },
  }];
}
