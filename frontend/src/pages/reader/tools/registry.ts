// ReaderTools定义(对齐 legacy 顶栏四件套 + 下载在 FAB 另区)

export type ReaderToolId = "notes" | "favorites" | "markdown" | "ai";

export type ReaderToolDef = {
  id: ReaderToolId;
  label: string;
  /** 副文案(关 / 开) */
  subIdle: string;
  subOpen: string;
  /** 源Documents只读时yesno禁用 */
  needsJob: boolean;
};

/** 与 legacy ReaderTopbarActions.TOOL_BUTTONS 同一套能力 */
export const READER_TOOLS: readonly ReaderToolDef[] = Object.freeze([
  {
    id: "notes",
    label: "annotations",
    subIdle: "选中文字后添加",
    subOpen: "Close悬浮窗",
    needsJob: false,
  },
  {
    id: "favorites",
    label: "Excerpt",
    subIdle: "books书Cloud favorites",
    subOpen: "Close悬浮窗",
    needsJob: false,
  },
  {
    id: "markdown",
    label: "Markdown",
    subIdle: "识别 / Translation文books",
    subOpen: "Close悬浮窗",
    needsJob: true,
  },
  {
    id: "ai",
    label: "AI Q&A",
    subIdle: "基于Documents提问",
    subOpen: "Close悬浮窗",
    needsJob: true,
  },
]);



