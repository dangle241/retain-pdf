import {
  createStore,
  DEFAULT_FILE_LABEL,
} from "../../composition/external.js";
import type { Store } from "../../composition/external.js";

// Upload domain view store + React viewPort.
//
// Legacy world: features/upload/upload-view-port.js + tile-view.js wrote DOM directly;
// In React world, mountUploadFeature (pure logic controller, reused as-is) gets the file
// generated viewPort: all "write view" goes to store, rendered by HeroUpload.jsx subscriptions;
// "read view" (selectedFile/readPageRanges) is taken from domRefs / store.
// Method semantics mirror tile-view.js / view.js / ui/job-actions-view.js entry by entry.
//
// Note: File objects do not go into store (store does structuredClone deep copy),
// file body is always read from domRefs.fileInput (React ref backfill).

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

// Initial values mirror partials/main-content.html static skeleton (pre-hydration status)
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
      help: "After upload, file validation runs first, then task processing begins.",
      helpVisible: true,
      status: "No file selected",
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
  // React ref backfill point: written after HeroUpload.jsx mounts #file
  const domRefs: UploadDomRefs = { fileInput: null };

  const patch = (payload: Partial<UploadViewState> = {}) => store.actions.patch(payload);

  // ---- tile-view.js mirror (workflow viewPort also goes through this group via uploadTilePort) ----

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

  // ---- ui/job-actions-view.js mirror (UploadProgress/reset chain) ----

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

  // View-side reset (resetUploadedFileView scope); upload status reset is handled by composition
  function resetUploadedFileView() {
    clearFileInputValue();
    patch({
      progressVisible: false,
      uploading: false,
      ready: false,
      progressPercent: 0,
      progressText: "Uploading",
      actionSlotVisible: false,
      status: "No file uploaded",
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



