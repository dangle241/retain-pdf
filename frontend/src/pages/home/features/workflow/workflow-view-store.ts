import { createStore } from "../../composition/external.js";
import type { Store } from "../../composition/external.js";

// Workflow domain view store + React viewPort.
//
// mountWorkflowFeature (pure logic controller, reused as-is) viewPort contract lands here
// in store, rendered by WorkflowPanel/HeroUpload/PageRangeDialog subscriptions.
// applyMockUpload/applyWorkflowUpload/setSubmitControls/renderBudgetNote
// mirror features/workflow/view.js semantics entry by entry (that file is legacy DOM view, do not import).
//
// Developer settings dialog (developer-settings-dialog) is a 3b misc-item scope:
// setDeveloperDialog/readDeveloperDialog first round-trip via store values (not DOM form),
// when 3b React-ifies this dialog, replace these two method implementations; controller is unaffected.

/** Developer settings selectable glossary options (normalized) */
export type WorkflowGlossaryOption = {
  glossaryId: string;
  name: string;
  entryCount: number | null;
};

/** API list raw items (setDeveloperGlossaryOptions input) */
export type WorkflowGlossarySource = {
  glossary_id?: string;
  name?: string;
  entry_count?: number | string | null;
  [key: string]: unknown;
};

export type WorkflowBudgetNote = {
  visible: boolean;
  tone: string;
  message: string;
  blocking: boolean;
  topUpUrl: string;
};

/** Developer dialog persistent fields (shape written by controller, read on demand) */
export type WorkflowDeveloperDialog = {
  workflow?: string;
  renderSourceJobId?: string;
  model?: unknown;
  baseUrl?: unknown;
  glossaryId?: string;
  workers?: unknown;
  batchSize?: unknown;
  classifyBatchSize?: unknown;
  compileWorkers?: unknown;
  timeoutSeconds?: unknown;
  [key: string]: unknown;
};

export type WorkflowViewState = {
  submitLabel: string;
  submitDisabled: boolean;
  submitBusy: boolean;
  pageRangeButtonVisible: boolean;
  budget: WorkflowBudgetNote;
  jobWarningVisible: boolean;
  glossaries: WorkflowGlossaryOption[];
  selectedGlossaryId: string;
  developerDialog: WorkflowDeveloperDialog;
  developerFormState: Record<string, unknown>;
};

export type WorkflowViewActions = {
  patch(
    currentState: WorkflowViewState,
    payload?: Partial<WorkflowViewState>,
  ): WorkflowViewState;
};

export type WorkflowViewStore = Store<WorkflowViewState, WorkflowViewActions>;

/** Workflow → upload tile port (upload-view-store.uploadTilePort) */
export type WorkflowUploadTilePort = {
  setUploadActionSlotVisible?: (visible?: boolean) => void;
  setUploadTileLocked?: (options?: { locked?: boolean; enabled?: boolean }) => void;
  setUploadTileText?: (options?: {
    label?: string;
    labelTitle?: string;
    help?: string;
    status?: string;
    statusVisible?: boolean | null;
    labelVisible?: boolean;
    helpVisible?: boolean;
  }) => void;
};

export function createWorkflowViewStore(): WorkflowViewStore {
  return createStore<WorkflowViewState, WorkflowViewActions>({
    name: "homeWorkflowView",
    initialState: {
      submitLabel: "Translate directly",
      submitDisabled: true,
      submitBusy: false,
      pageRangeButtonVisible: true,
      budget: {
        visible: false,
        tone: "",
        message: "",
        blocking: false,
        topUpUrl: "",
      },
      jobWarningVisible: false,
      glossaries: [],
      selectedGlossaryId: "",
      developerDialog: {},
      developerFormState: {},
    },
    actions: {
      patch(currentState, payload = {}) {
        return { ...currentState, ...payload };
      },
    },
  });
}

export function createWorkflowViewFeature({
  store = createWorkflowViewStore(),
  uploadTilePort,
}: {
  store?: WorkflowViewStore;
  uploadTilePort?: WorkflowUploadTilePort | null;
} = {}) {
  const patch = (payload: Partial<WorkflowViewState> = {}) => store.actions.patch(payload);

  function setSubmitBusy(busy = false) {
    patch({ submitBusy: Boolean(busy) });
  }

  function setSubmitDisabled(disabled = true) {
    patch({ submitDisabled: Boolean(disabled) });
  }

  function selectedGlossaryId() {
    return `${store.getSnapshot().selectedGlossaryId || ""}`.trim();
  }

  function setSelectedGlossaryId(value = "") {
    patch({ selectedGlossaryId: `${value || ""}`.trim() });
  }

  function setJobWarningVisible(visible: boolean) {
    patch({ jobWarningVisible: Boolean(visible) });
  }

  // ---- features/workflow/view.js mirror ----

  function setSubmitControls({
    disabled,
    label,
    actionVisible,
    pageRangeVisible,
  }: {
    disabled?: boolean;
    label?: string;
    actionVisible?: boolean;
    pageRangeVisible?: boolean;
  } = {}) {
    patch({
      submitDisabled: Boolean(disabled),
      submitLabel: `${label ?? ""}` || store.getSnapshot().submitLabel,
      pageRangeButtonVisible: Boolean(pageRangeVisible),
    });
    uploadTilePort?.setUploadActionSlotVisible(actionVisible);
  }

  function renderBudgetNote(budget?: Partial<WorkflowBudgetNote> | null) {
    patch({
      budget: {
        visible: Boolean(budget?.visible),
        tone: `${budget?.tone || ""}`,
        message: `${budget?.message || ""}`,
        blocking: Boolean(budget?.blocking),
        topUpUrl: `${budget?.topUpUrl || ""}`,
      },
    });
  }

  function applyMockUpload({
    mockScenario,
    submitLabel,
    showPageRangeButton,
  }: {
    mockScenario?: string;
    submitLabel?: string;
    showPageRangeButton?: boolean;
  } = {}) {
    uploadTilePort?.setUploadTileLocked({ locked: true, enabled: false });
    uploadTilePort?.setUploadTileText({
      label: "Mock mode",
      labelTitle: "",
      help: `Currently in mock mode: ${mockScenario || "running"}. No file upload, no real backend requests.`,
      status: "Mock mode enabled. You can click to start translation directly.",
      statusVisible: true,
    });
    setSubmitControls({
      disabled: false,
      label: submitLabel,
      actionVisible: true,
      pageRangeVisible: showPageRangeButton,
    });
  }

  function applyWorkflowUpload({
    needsUpload,
    uploadReady,
    defaultFileLabel,
    headline,
    renderSourceJobId,
  }: {
    needsUpload?: boolean;
    uploadReady?: boolean;
    defaultFileLabel?: string;
    headline?: string;
    renderSourceJobId?: string;
  } = {}) {
    uploadTilePort?.setUploadTileLocked({ locked: !needsUpload, enabled: needsUpload });
    uploadTilePort?.setUploadTileText({
      label: !uploadReady ? (needsUpload ? defaultFileLabel : "Reuse existing task output") : "",
      labelTitle: "",
      help: headline,
      status: !needsUpload
        ? (renderSourceJobId
            ? `Will reuse task: ${renderSourceJobId}`
            : "Enter the render source job ID in developer settings first.")
        : "",
      statusVisible: !needsUpload ? true : (!uploadReady ? false : null),
    });
  }

  function setDeveloperGlossaryOptions(
    glossaries: WorkflowGlossarySource[] = [],
    selectedId = "",
  ) {
    patch({
      glossaries: (Array.isArray(glossaries) ? glossaries : [])
        .map((glossary) => ({
          glossaryId: `${glossary?.glossary_id || ""}`.trim(),
          name: `${glossary?.name || glossary?.glossary_id || ""}`.trim(),
          entryCount: Number.isFinite(Number(glossary?.entry_count))
            ? Number(glossary.entry_count)
            : null,
        }))
        .filter((glossary) => glossary.glossaryId),
      selectedGlossaryId: `${selectedId || ""}`.trim(),
    });
  }

  // ---- Developer settings dialog (3b takeover point) ----

  function setDeveloperDialog(config: WorkflowDeveloperDialog = {}) {
    patch({ developerDialog: { ...config } });
  }

  function readDeveloperDialog(defaults: Partial<WorkflowDeveloperDialog> = {}) {
    const saved = store.getSnapshot().developerDialog || {};
    return {
      workflow: saved.workflow,
      renderSourceJobId: `${saved.renderSourceJobId || ""}`.trim(),
      model: saved.model || defaults.model,
      baseUrl: saved.baseUrl || defaults.baseUrl,
      glossaryId: selectedGlossaryId() || `${saved.glossaryId || ""}`.trim(),
      workers: saved.workers ?? defaults.workers,
      batchSize: saved.batchSize ?? defaults.batchSize,
      classifyBatchSize: saved.classifyBatchSize ?? defaults.classifyBatchSize,
      compileWorkers: saved.compileWorkers ?? defaults.compileWorkers,
      timeoutSeconds: saved.timeoutSeconds ?? defaults.timeoutSeconds,
    };
  }

  function readDeveloperWorkflow() {
    return store.getSnapshot().developerDialog?.workflow;
  }

  function setDeveloperWorkflowFormState(payload: Record<string, unknown> = {}) {
    patch({ developerFormState: { ...payload } });
  }

  const viewPort = {
    applyMockUpload,
    applyWorkflowUpload,
    closeDeveloperDialog: () => {},
    readDeveloperDialog,
    readDeveloperWorkflow,
    renderBudgetNote,
    setDeveloperDialog,
    setDeveloperGlossaryOptions,
    setDeveloperWorkflowFormState,
    setSubmitControls,
  };

  return {
    patch,
    selectedGlossaryId,
    setJobWarningVisible,
    setSelectedGlossaryId,
    setSubmitBusy,
    setSubmitDisabled,
    store,
    viewPort,
  };
}





