// Reader tools definitions (aligned with the legacy top-bar quartet + downloads live in a separate FAB zone)

export type ReaderToolId = "notes" | "favorites" | "markdown" | "ai";

export type ReaderToolDef = {
  id: ReaderToolId;
  label: string;
  /** Secondary copy (closed / open) */
  subIdle: string;
  subOpen: string;
  /** Whether to disable when the source document is read-only */
  needsJob: boolean;
};

/** Same capabilities as legacy ReaderTopbarActions.TOOL_BUTTONS */
export const READER_TOOLS: readonly ReaderToolDef[] = Object.freeze([
  {
    id: "notes",
    label: "annotations",
    subIdle: "Add after selecting text",
    subOpen: "Close popover",
    needsJob: false,
  },
  {
    id: "favorites",
    label: "Excerpt",
    subIdle: "Cloud favorites",
    subOpen: "Close popover",
    needsJob: false,
  },
  {
    id: "markdown",
    label: "Markdown",
    subIdle: "Recognize / Translate text",
    subOpen: "Close popover",
    needsJob: true,
  },
  {
    id: "ai",
    label: "AI Q&A",
    subIdle: "Ask questions based on document",
    subOpen: "Close popover",
    needsJob: true,
  },
]);



