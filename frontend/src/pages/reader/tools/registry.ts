// Reader tool definition (alignment legacy Top bar four-piece set + Download at FAB Other area)

export type ReaderToolId = "notes" | "favorites" | "markdown" | "ai";

export type ReaderToolDef = {
  id: ReaderToolId;
  label: string;
  /** Secondary copy (off / Open */
  subIdle: string;
  subOpen: string;
  /** Disable when source doc read-only? */
  needsJob: boolean;
};

/** Same capabilities as legacy ReaderTopbarActions.TOOL_BUTTONS */
export const READER_TOOLS: readonly ReaderToolDef[] = Object.freeze([
  {
    id: "notes",
label: "Annotation",
    subIdle: "Add after selection",
    subOpen: "Close floating window",
    needsJob: false,
  },
  {
    id: "favorites",
label: "Excerpt",
    subIdle: "Cloud Favorite",
subOpen: "Close floating window",
    needsJob: false,
  },
  {
    id: "markdown",
    label: "Markdown",
subIdle: "Recognize / Translated text",
subOpen: "Close floating window",
    needsJob: true,
  },
  {
    id: "ai",
label: "AI Q&A",
    subIdle: "Ask from Document",
subOpen: "Close floating window",
    needsJob: true,
  },
]);
