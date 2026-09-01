// GlossariesDialog 的纯视图态 + 与 features/glossaries/controller.js(kept
// 控制器)对接的 store 驱动 viewPort(蓝图 §3,镜像
// credentials-view-store.js 的写法)。
//
// 旧世界 glossary-view-port.js/view.js 全部是 DOM 直写(死,不 import);这里
// 用同名方法签名重新实现,只是"写"的目的地从 DOM 换成 store,让
// GlossariesDialog.jsx 系的组件订阅渲染。controller.js(reload/select/save/
// delete/export/applyImport 等编排逻辑)一行不改地复用。

import type { DialogStore } from "../../state/dialog-store.js";
import type { HandlersBag } from "../../composition/types.js";
import { createStore } from "../../composition/external.js";
import type { Store } from "../../composition/external.js";

/** 列表项（API 列表摘要） */
export type GlossaryListItem = {
  glossary_id?: string;
  name?: string;
  entry_count?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

/** 编辑器行（受控表格） */
export type GlossaryEntryRow = {
  source: string;
  target: string;
  note: string;
  level: string;
  match_mode: string;
};

export type GlossaryDraft = {
  name: string;
  entries: GlossaryEntryRow[];
};

/** save() 读取的编辑器 payload（含 preserve 语义） */
export type GlossaryEditorPayload = {
  name: string;
  entries: Array<{
    source: string;
    target: string;
    level: string;
    match_mode: string;
    context: string;
    note: string;
  }>;
  skippedMissingTarget: string[];
};

export type GlossariesViewState = {
  items: GlossaryListItem[];
  selectedId: string;
  draft: GlossaryDraft;
  status: { message: string; tone: string };
  importVisible: boolean;
  csvText: string;
};

export type GlossariesViewActions = {
  setList(
    state: GlossariesViewState,
    payload?: { items?: GlossaryListItem[]; selectedId?: string },
  ): GlossariesViewState;
  setDraft(
    state: GlossariesViewState,
    payload?: { name?: string; entries?: Array<Partial<GlossaryEntryRow> | GlossaryEntryRow> },
  ): GlossariesViewState;
  setName(state: GlossariesViewState, name?: string): GlossariesViewState;
  addEntryRow(
    state: GlossariesViewState,
    entry?: Partial<GlossaryEntryRow>,
  ): GlossariesViewState;
  updateEntryField(
    state: GlossariesViewState,
    payload?: { index?: number; field?: keyof GlossaryEntryRow; value?: string },
  ): GlossariesViewState;
  removeEntryRow(state: GlossariesViewState, index: number): GlossariesViewState;
  setStatus(
    state: GlossariesViewState,
    payload?: { message?: string; tone?: string },
  ): GlossariesViewState;
  setImportVisible(state: GlossariesViewState, visible?: boolean): GlossariesViewState;
  setCsvText(state: GlossariesViewState, csvText?: string): GlossariesViewState;
};

export type GlossariesViewStore = Store<GlossariesViewState, GlossariesViewActions>;

function normalizeEntryForRow(entry: Partial<GlossaryEntryRow> = {}): GlossaryEntryRow {
  return {
    source: entry.source || "",
    target: entry.target || "",
    note: entry.note || "",
    level: entry.level || "preserve",
    match_mode: entry.match_mode || "case_insensitive",
  };
}

// 抄自 src/js/features/glossaries/view.js:155-184
// (readGlossaryEditorPayload)——尤其第 165 行的 preserve 语义必须原样保留:
// level==="preserve" 且用户没有手填译文时,target 用 source 回填(“保留原词”
// 语义,不是“译文缺失”);level 不是 preserve 时留空则视为“漏填译文”,计入
// skippedMissingTarget,由 controller.js 的 save() 拦截并提示错误。
function readEditorPayloadFromDraft(draft: GlossaryDraft): GlossaryEditorPayload {
  const entries: GlossaryEditorPayload["entries"] = [];
  const skippedMissingTarget: string[] = [];
  for (const row of draft.entries) {
    const source = `${row.source || ""}`.trim();
    if (!source) {
      continue;
    }
    const level = row.level || "preserve";
    const typedTarget = `${row.target || ""}`.trim();
    const target = typedTarget || (level === "preserve" ? source : "");
    if (!target) {
      skippedMissingTarget.push(source);
      continue;
    }
    entries.push({
      source,
      target,
      level,
      match_mode: row.match_mode || "case_insensitive",
      context: "",
      note: `${row.note || ""}`.trim(),
    });
  }
  return {
    name: `${draft.name || ""}`.trim() || "未命名术语表",
    entries,
    skippedMissingTarget,
  };
}

export function createGlossariesViewFeature({
  dialogStore,
}: {
  dialogStore: DialogStore;
}) {
  const store = createStore<GlossariesViewState, GlossariesViewActions>({
    name: "glossariesView",
    initialState: {
      items: [],
      selectedId: "",
      draft: { name: "", entries: [] },
      status: { message: "", tone: "" },
      importVisible: false,
      csvText: "",
    },
    actions: {
      setList(currentState, { items = [], selectedId = "" } = {}) {
        return { ...currentState, items, selectedId };
      },
      setDraft(currentState, { name = "", entries = [] } = {}) {
        return {
          ...currentState,
          draft: { name, entries: entries.map((entry) => normalizeEntryForRow(entry)) },
        };
      },
      setName(currentState, name = "") {
        return { ...currentState, draft: { ...currentState.draft, name } };
      },
      addEntryRow(currentState, entry = {}) {
        return {
          ...currentState,
          draft: {
            ...currentState.draft,
            entries: [...currentState.draft.entries, normalizeEntryForRow(entry)],
          },
        };
      },
      updateEntryField(currentState, { index, field, value } = {}) {
        if (field == null || index == null) {
          return currentState;
        }
        const entries = currentState.draft.entries.map((row, rowIndex) => (
          rowIndex === index ? { ...row, [field]: value } : row
        ));
        return { ...currentState, draft: { ...currentState.draft, entries } };
      },
      removeEntryRow(currentState, index) {
        const entries = currentState.draft.entries.filter((_row, rowIndex) => rowIndex !== index);
        return { ...currentState, draft: { ...currentState.draft, entries } };
      },
      setStatus(currentState, { message = "", tone = "" } = {}) {
        return { ...currentState, status: { message, tone } };
      },
      setImportVisible(currentState, visible = false) {
        return { ...currentState, importVisible: Boolean(visible) };
      },
      setCsvText(currentState, csvText = "") {
        return { ...currentState, csvText: `${csvText || ""}` };
      },
    },
  });

  // controller.js 在装配时同步调用一次 feature.bindEvents()(见
  // composition.js)捕获 open/close/reload/selectGlossary/createNew/addRow/
  // save/deleteCurrent/exportCurrent/showImport/hideImport/applyImport 等
  // 处理函数——React 世界没有旧 view.js 那种全局 DOM 监听步骤,JSX 按钮的
  // onClick 直接从这里取用(见 useGlossariesController.js)。
  const handlersRef: { current: HandlersBag | null } = { current: null };

  const viewPort = {
    openDialog: () => dialogStore.open(),
    closeDialog: () => dialogStore.close(),
    setStatus: (message = "", tone = "") => store.actions.setStatus({ message, tone }),
    renderList: (items: GlossaryListItem[] = [], selectedId = "") => store.actions.setList({ items, selectedId }),
    renderEditor: (detail: { name?: string; entries?: Array<Partial<GlossaryEntryRow>> } = {}) => store.actions.setDraft(detail),
    addEntryRow: (entry: Partial<GlossaryEntryRow> = {}) => store.actions.addEntryRow(entry),
    readEditorPayload: () => readEditorPayloadFromDraft(store.getSnapshot().draft),
    setImportVisible: (visible = false) => store.actions.setImportVisible(visible),
    readCsvText: () => store.getSnapshot().csvText,
    clearCsvText: () => store.actions.setCsvText(""),
    bindEvents: (handlers: HandlersBag) => {
      handlersRef.current = handlers;
    },
  };

  return {
    store,
    viewPort,
    handlersRef,
  };
}
