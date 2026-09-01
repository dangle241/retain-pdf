// BookCard Action按钮工厂聚合.
// 每种Tools一个Files；booksFiles只组合, 不写 onClick 业务细节.

import { buildReadBookCardAction } from "./read.js";
import { buildTranslateBookCardAction } from "./translate.js";
import type { BookCardAction, BookCardActionHandlers, LibraryCardItem } from "../types.js";

export { BOOK_CARD_ACTION_READ, buildReadBookCardAction } from "./read.js";
export {
  BOOK_CARD_ACTION_TRANSLATE,
  buildTranslateBookCardAction,
} from "./translate.js";

/** 默认: 只有快速阅读. */
export function buildDefaultBookCardActions(
  item: LibraryCardItem = {},
  handlers: BookCardActionHandlers = {},
): BookCardAction[] {
  return buildReadBookCardAction(item, handlers);
}

/** 阅读 +(有entries件时)Translation. */
export function buildShelfBookCardActions(
  item: LibraryCardItem = {},
  handlers: BookCardActionHandlers = {},
): BookCardAction[] {
  return [
    ...buildReadBookCardAction(item, handlers),
    ...buildTranslateBookCardAction(item, handlers),
  ];
}

export function bookCardActionsSignature(actions: BookCardAction[] | null | undefined): string {
  if (!Array.isArray(actions) || !actions.length) return "";
  return actions
    .map(
      (a) =>
        `${a?.id ?? ""}|${a?.label ?? ""}|${a?.disabled ? "1" : "0"}|${a?.className ?? ""}`,
    )
    .join(";");
}



