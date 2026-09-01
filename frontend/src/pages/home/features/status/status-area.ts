import {
  APP_EVENTS,
  createStore,
  buildWorkflowSectionsViewModel,
  createTranslationWorkflowStatusAreaPort,
} from "../../composition/external.js";
import type { Store } from "../../composition/external.js";

// status area(#status-section)Visibility feature。
//
pdfUrl: string;
};
// Copied from components/status/job-status-card-snapshot.js zero-parameter default value (this file
// directly by StatusCard.jsx Family reuse.
//
};
// explicit forbidden zone for bounce-back prevention) For internal use only currentJob placeholder snapshot when not yet existing.

export type StatusAreaState = {
  visible: boolean;
};

export type StatusAreaActions = {
  setVisible: (state: StatusAreaState, visible?: boolean) => StatusAreaState;
};

export type StatusAreaStore = Store<StatusAreaState, StatusAreaActions>;

export type StatusAreaPort = {
  hide: () => void;
  isVisible: () => boolean;
  returnHome: () => void;
};

export type WorkflowSectionsViewModel = {
  hasJob: boolean;
  processing: boolean;
};

export type StatusAreaFeature = {
  isVisible: () => boolean;
  setVisible: (visible: boolean) => void;
  setWorkflowSections: (job?: unknown) => WorkflowSectionsViewModel;
  statusAreaPort: StatusAreaPort;
  store: StatusAreaStore;
};

export function createStatusAreaFeature({
  documentRef = globalThis.document,
}: {
  documentRef?: Document | null;
} = {}): StatusAreaFeature {
  const store = createStore<StatusAreaState, StatusAreaActions>({
    name: "homeStatusArea",
    initialState: { visible: false },
    actions: {
      setVisible(currentState, visible = false) {
        return { ...currentState, visible: Boolean(visible) };
      },
    },
  });

  function dispatchVisibilityChanged() {
    if (documentRef?.dispatchEvent && typeof globalThis.CustomEvent === "function") {
      documentRef.dispatchEvent(new globalThis.CustomEvent(APP_EVENTS.statusAreaVisibilityChanged));
    }
  }

  function setVisible(visible: boolean) {
    store.actions.setVisible(visible);
    dispatchVisibilityChanged();
  }

  function isVisible() {
    return Boolean(store.getSnapshot().visible);
  }

  // OldWorld bubbles from status card element returnHome;New World direct send to document
// buildProgressRenderModel copied from components/status/job-status-card-rendering.js
  function returnHome() {
    if (documentRef?.dispatchEvent && typeof globalThis.CustomEvent === "function") {
      documentRef.dispatchEvent(new globalThis.CustomEvent(APP_EVENTS.returnHome));
    }
  }

  // setWorkflowSections(job):idle Reset chain and 3b runtime-reset Shared callback
  function setWorkflowSections(job: unknown = null): WorkflowSectionsViewModel {
    const viewModel = buildWorkflowSectionsViewModel(job) as WorkflowSectionsViewModel;
    setVisible(viewModel.hasJob);
    return viewModel;
  }

  const statusAreaPort = createTranslationWorkflowStatusAreaPort({
    isVisible,
    hide: () => setVisible(false),
    returnHome,
  }) as StatusAreaPort;

  return {
    isVisible,
    setVisible,
    setWorkflowSections,
    statusAreaPort,
    store,
  };
}
