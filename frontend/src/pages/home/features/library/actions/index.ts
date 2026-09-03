// BookCard action button factory aggregator.
// One file per action kind; this file only composes them, no onClick business details.

import { buildReadBookCardAction } from "./read.js";
import { buildTranslateBookCardAction } from "./translate.js";
import type { BookCardAction, BookCardActionHandlers, LibraryCardItem } from "../types.js";

export { BOOK_CARD_ACTION_READ, buildReadBookCardAction } from "./read.js";
export {
  BOOK_CARD_ACTION_TRANSLATE,
  buildTranslateBookCardAction,
} from "./translate.js";

/** Default: quick read only. */
export function buildDefaultBookCardActions(
  item: LibraryCardItem = {},
  handlers: BookCardActionHandlers = {},
): BookCardAction[] {
  return buildReadBookCardAction(item, handlers);
}

/** Read + (when entry conditions are met) translate. */
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



