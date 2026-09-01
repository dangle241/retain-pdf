// GlossariesDialog pure view state + store driving viewPort interfacing with features/glossaries/controller.js (kept
// controller) (Blueprint Â§3, mirroring
// credentials-view-store.js implementation).
//
// Old world glossary-view-port.js/view.js were all direct DOM writes (dead, do not import); here
// Reimplement using same-name method signature. Only the "write" destination changes from DOM to store, allowing
// GlossariesDialog.jsx system's component subscription rendering.controller.js(reload/select/save/
// delete/export/applyImport Await orchestration logic.) to be reused without changing a single line.

import type { DialogStore } from "../../state/dialog-store.js";
import type { HandlersBag } from "../../composition/types.js";
import { createStore } from "../../composition/external.js";
import type { Store } from "../../composition/external.js";

/** List item (API List summary) */
export type GlossaryListItem = {
  glossary_id?: string;
  name?: string;
  entry_count?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

/** Editor row (controlled table) */
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

/** save() Editor payload read payload (including preserve semantics) */
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

// Copied from src/js/features/glossaries/view.js:155-184
// (readGlossaryEditorPayload)——Especially the 165 Understood. preserve semantics must be preserved exactly:
// level==="preserve" when user hasn't manually entered translation, target filled with source (Keep original term.
// semantics, Not "translation missing"); if level is not preserve, Empty is treated as "missing translation", count towards
// skippedMissingTarget, intercepted and displayed as error by controller.js save().
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
name: `${draft.name || ""}`.trim() || "Unnamed Glossary",
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

// controller.js Call synchronously once during assembly. feature.bindEvents() (see
// composition.js) captures open/close/reload/selectGlossary/createNew/addRow/
// save/deleteCurrent/exportCurrent/showImport/hideImport/applyImport etc.
// Handler ââ React World has no old view.js Global scope DOM Listen steps, JSX button's
// onClick Fetch directly from here (see useGlossariesController.js).
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
