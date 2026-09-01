import {
  createStore,
  DEFAULT_FILE_LABEL,
} from "../../composition/external.js";
import type { Store } from "../../composition/external.js";

// upload Domain view store + React viewPort。
//
// Old world features/upload/upload-view-port.js + tile-view.js wrote directly to DOM;
// React in the world mountUploadFeature(Pure logic controller,Reuse as-is.)Got this file
// Generated viewPort: all "YAGNI. Define data shape first. View is derivative." land in store, subscribed to by HeroUpload.jsx for rendering;
// "read view" (selectedFile/readPageRanges) fetched from domRefs / store.
// Mirror each method's semantics individually. tile-view.js / view.js / ui/job-actions-view.js。
//
// Note: File Object does not enter store (store uses structuredClone Deep copy),
// File body always read from domRefs.fileInput (React ref backfill).

export type UploadViewState = {
  tileLocked: boolean;
  tileEnabled: boolean;
  ready: boolean;
  uploading: boolean;
  label: string;
  labelTitle: string;
  labelVisible: boolean;
  help: string;
  helpVisible: boolean;
  status: string;
  statusVisible: boolean;
  progressVisible: boolean;
  progressPercent: number;
  progressText: string;
  actionSlotVisible: boolean;
  inlinePageRangeVisible: boolean;
  pageRangeStart: string;
  pageRangeEnd: string;
  pageRangeMax: number;
  pageRangeDialogOpen: boolean;
  credentialGateVisible: boolean;
};

export type UploadViewActions = {
  patch(
    currentState: UploadViewState,
    payload?: Partial<UploadViewState>,
  ): UploadViewState;
};

export type UploadViewStore = Store<UploadViewState, UploadViewActions>;

export type UploadTileLockedOptions = {
  locked?: boolean;
  enabled?: boolean;
};

export type UploadTileTextOptions = {
  label?: string;
  labelTitle?: string;
  help?: string;
  status?: string;
  statusVisible?: boolean | null;
  labelVisible?: boolean;
  helpVisible?: boolean;
};

export type UploadPageRangeDialogOptions = {
  maxPage?: number;
};

export type UploadPageRangesWrite = {
  start?: string | number;
  end?: string | number;
};

export type UploadFileLabelSource = {
  name?: string;
} | null | undefined;

export type UploadDomRefs = {
  fileInput: HTMLInputElement | null;
};

// Initial value mirror partials/main-content.html Static skeleton(Pre-hydration state)
export function createUploadViewStore(): UploadViewStore {
  return createStore<UploadViewState, UploadViewActions>({
    name: "homeUploadView",
    initialState: {
      tileLocked: false,
      tileEnabled: true,
      ready: false,
      uploading: false,
label: "Add PDF",
      labelTitle: "",
      labelVisible: true,
      help: "File upload completes checksum validation before task processing.",
      helpVisible: true,
      status: "No file selected.",
      statusVisible: false,
      progressVisible: false,
      progressPercent: 0,
      progressText: "Uploading",
      actionSlotVisible: false,
      inlinePageRangeVisible: false,
      pageRangeStart: "",
      pageRangeEnd: "",
      pageRangeMax: 0,
      pageRangeDialogOpen: false,
      credentialGateVisible: false,
    },
    actions: {
      patch(currentState, payload = {}) {
        return { ...currentState, ...payload };
      },
    },
  });
}

export function createUploadViewFeature({
  store = createUploadViewStore(),
}: {
  store?: UploadViewStore;
} = {}) {
// React ref Backfill point: HeroUpload.jsx mounts #file Write last
  const domRefs: UploadDomRefs = { fileInput: null };

  const patch = (payload: Partial<UploadViewState> = {}) => store.actions.patch(payload);

// ---- tile-view.js mirror (workflow viewPort via uploadTilePort also uses this group) ----

  function setUploadTileLocked({
    locked = false,
    enabled = !locked,
  }: UploadTileLockedOptions = {}) {
    patch({ tileLocked: Boolean(locked), tileEnabled: Boolean(enabled) });
  }

  function setUploadTileText({
    label = "",
    labelTitle = "",
    help = "",
    status = "",
    statusVisible = null,
    labelVisible = true,
    helpVisible = true,
  }: UploadTileTextOptions = {}) {
    const next: Partial<UploadViewState> = {
      labelVisible: Boolean(labelVisible),
      helpVisible: Boolean(helpVisible),
    };
    if (label) {
      next.label = label;
      next.labelTitle = labelTitle;
    }
    if (help) {
      next.help = help;
    }
    if (status) {
      next.status = status;
    }
    next.statusVisible = Boolean(statusVisible ?? Boolean(status));
    patch(next);
  }

  function setUploadTileReady(ready: boolean) {
    patch({ ready: Boolean(ready), uploading: false });
  }

  function setUploadActionSlotVisible(visible: boolean) {
    patch({ actionSlotVisible: Boolean(visible) });
  }

// ---- ui/job-actions-view.js mirror (Upload progress/reset chain) ----

  function setUploadProgress(loaded: number, total: number) {
    const hasNumbers = Number.isFinite(loaded) && Number.isFinite(total) && total > 0;
    const percent = hasNumbers
      ? Math.max(0, Math.min(100, (loaded / total) * 100))
      : 18;
    patch({
      progressVisible: true,
      uploading: true,
      ready: false,
      actionSlotVisible: false,
      progressPercent: percent,
progressText: hasNumbers ? `Uploading ${percent.toFixed(0)}%` : "Uploading",
    });
  }

  function resetUploadProgress() {
    patch({
      progressVisible: false,
      uploading: false,
      progressPercent: 0,
progressText: "Uploading",
    });
  }

  function clearFileInputValue() {
    if (domRefs.fileInput) {
      domRefs.fileInput.value = "";
    }
  }

// View-side reset (resetUploadedFileView scope); Reset upload status to zero by composition
  function resetUploadedFileView() {
    clearFileInputValue();
    patch({
      progressVisible: false,
      uploading: false,
      ready: false,
      progressPercent: 0,
progressText: "Uploading",
      actionSlotVisible: false,
      status: "No file uploaded.",
      statusVisible: false,
      label: DEFAULT_FILE_LABEL,
      labelTitle: "",
      labelVisible: true,
    });
  }

// ---- features/upload/view.js mirror (mountUploadFeature viewPort contract) ----

  const viewPort = {
    clearPageRanges: () => patch({ pageRangeStart: "", pageRangeEnd: "" }),
    closePageRangeDialog: () => patch({ pageRangeDialogOpen: false }),
    markUploadReady: (ready: boolean) => setUploadTileReady(ready),
    openPageRangeDialog: ({ maxPage = 0 }: UploadPageRangeDialogOptions = {}) =>
      patch({
        pageRangeDialogOpen: true,
        pageRangeMax: Number(maxPage) > 0 ? Math.floor(Number(maxPage)) : 0,
      }),
    readPageRanges: () => {
      const snapshot = store.getSnapshot();
      return { start: snapshot.pageRangeStart || "", end: snapshot.pageRangeEnd || "" };
    },
    selectedFile: (): File | null => domRefs.fileInput?.files?.[0] || null,
    setFileLabel: (file: UploadFileLabelSource, defaultFileLabel: string) => {
      const name = file?.name ? `${file.name}` : "";
      return setUploadTileText({
        label: name || defaultFileLabel,
        labelTitle: name,
      });
    },
    setInlinePageRangeVisible: (visible: boolean) =>
      patch({ inlinePageRangeVisible: Boolean(visible) }),
    showUploadStatus: (message: string) =>
      setUploadTileText({ status: message, statusVisible: true }),
    writePageRanges: ({ start = "", end = "" }: UploadPageRangesWrite = {}) =>
      patch({
        pageRangeStart: `${start}`,
        pageRangeEnd: `${end}`,
      }),
  };

  const uploadTilePort = {
    setUploadActionSlotVisible,
    setUploadTileLocked,
    setUploadTileText,
  };

  return {
    clearFileInputValue,
    domRefs,
    patch,
    resetUploadProgress,
    resetUploadedFileView,
    setUploadProgress,
    store,
    uploadTilePort,
    viewPort,
  };
}
