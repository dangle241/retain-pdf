import {
  APP_EVENTS,
  createStore,
  buildWorkflowSectionsViewModel,
  createTranslationWorkflowStatusAreaPort,
} from "../../composition/external.js";
import type { Store } from "../../composition/external.js";

// Feature khả năng hiển thị của vùng trạng thái (#status-section).
//
// 3a chỉ triển khai "khả năng hiển thị + hợp đồng sự kiện" (phản chiếu setStatusAreaVisible trong ui/status-area-view.js
// và setWorkflowSectionsView trong ui/presentation-view.js); bản thân StatusCard thuộc phạm vi 3b
// (recent-jobs + job-runtime trong thiết kế features/status/); store tại đây sau đó sẽ
// được họ StatusCard.jsx dùng trực tiếp.
//
// Hợp đồng sự kiện: mỗi lần setVisible đều dispatch statusAreaVisibilityChanged (giống hệ thống cũ;
// translation-workflow-dialog dựa vào đó để đồng bộ chế độ upload/status).

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

  // Hệ thống cũ làm nổi bọt returnHome từ phần tử thẻ trạng thái; hệ thống mới phát trực tiếp tới document
  // (phía nhận jobRuntimeFeature.returnToHome lắng nghe ở cấp document, được nối trong 3b).
  function returnHome() {
    if (documentRef?.dispatchEvent && typeof globalThis.CustomEvent === "function") {
      documentRef.dispatchEvent(new globalThis.CustomEvent(APP_EVENTS.returnHome));
    }
  }

  // setWorkflowSections(job): callback dùng chung cho chuỗi đặt lại idle và runtime-reset của 3b.
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
