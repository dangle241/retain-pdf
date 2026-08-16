// Tập hợp factory nút thao tác BookCard.
// Mỗi chức năng một tệp; tệp này chỉ ghép, không viết chi tiết nghiệp vụ onClick.

import { buildReadBookCardAction } from "./read.js";
import { buildTranslateBookCardAction } from "./translate.js";
import type { BookCardAction, BookCardActionHandlers, LibraryCardItem } from "../types.js";

export { BOOK_CARD_ACTION_READ, buildReadBookCardAction } from "./read.js";
export {
  BOOK_CARD_ACTION_TRANSLATE,
  buildTranslateBookCardAction,
} from "./translate.js";

/** Mặc định: chỉ có đọc nhanh. */
export function buildDefaultBookCardActions(
  item: LibraryCardItem = {},
  handlers: BookCardActionHandlers = {},
): BookCardAction[] {
  return buildReadBookCardAction(item, handlers);
}

/** Đọc + dịch khi đủ điều kiện. */
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
