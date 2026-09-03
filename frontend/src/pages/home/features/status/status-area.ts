import {
  APP_EVENTS,
  createStore,
  buildWorkflowSectionsViewModel,
  createTranslationWorkflowStatusAreaPort,
} from "../../composition/external.js";
import type { Store } from "../../composition/external.js";

// Status area (#status-section) visibility feature.
//
// 3a only addresses "visibility + Events contract" (mirrors ui/status-area-view.js setStatusAreaVisible
// and ui/presentation-view.js setWorkflowSectionsView): StatusCard book body is 3b's
// (recent-jobs + job-runtime Blueprint features/status/) scope; the store here will be
// directly reused by StatusCard.jsx family.
//
// Events contract: every setVisible dispatches statusAreaVisibilityChanged (same as old world;
// translation-workflow-dialog uses it to sync upload/status mode).

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

  // Old world bubbles returnHome from Status card element; new world dispatches directly to document
  // (consumer jobRuntimeFeature.returnToHome listens on document level; 3b wires it)
  function returnHome() {
    if (documentRef?.dispatchEvent && typeof globalThis.CustomEvent === "function") {
      documentRef.dispatchEvent(new globalThis.CustomEvent(APP_EVENTS.returnHome));
    }
  }

  // setWorkflowSections(job): idle reset chain and 3b runtime-reset total callback
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




