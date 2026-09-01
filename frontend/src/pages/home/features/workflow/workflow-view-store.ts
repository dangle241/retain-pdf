import { createStore } from "../../composition/external.js";
import type { Store } from "../../composition/external.js";

// workflow 域View store + React viewPort.
//
// mountWorkflowFeature(纯逻辑控制器,原样复用)的 viewPort 契约在这里落到
// store,由 WorkflowPanel/HeroUpload/PageRangeDialog 订阅Rendering.
// applyMockUpload/applyWorkflowUpload/setSubmitControls/renderBudgetNote
// 逐entries镜像 features/workflow/view.js 的语义(该Files属旧 DOM View,禁 import).
//
// 开发者Settings对话框(developer-settings-dialog)yes 3b 杂itemsScope:
// setDeveloperDialog/readDeveloperDialog 先以 store 值往返(不接 DOM 表单),
// 3b React 化该对话框时替换这两个方法的实现即可,控制器None感.

/** 开发者Settings里可选Glossary选items(归一化后) */
export type WorkflowGlossaryOption = {
  glossaryId: string;
  name: string;
  entryCount: number | null;
};

/** API List原始items(setDeveloperGlossaryOptions 输入) */
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

/** 开发者对话框持久字段(形状由 controller 写入, 消费时按需读) */
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

/** workflow → upload 瓦片端口(upload-view-store.uploadTilePort) */
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

  // ---- features/workflow/view.js 镜像 ----

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
      label: "Mock 模式",
      labelTitle: "",
      help: `Current为 mock 模式: ${mockScenario || "running"}.不会UploadFiles, 也不会请求真实后端.`,
      status: "Mock 模式已启用, 可直接点击开始Translation.",
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
      label: !uploadReady ? (needsUpload ? defaultFileLabel : "复用已有任务产物") : "",
      labelTitle: "",
      help: headline,
      status: !needsUpload
        ? (renderSourceJobId
            ? `Current将复用任务: ${renderSourceJobId}`
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

  // ---- 开发者Settings对话框(3b 接管点) ----

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





