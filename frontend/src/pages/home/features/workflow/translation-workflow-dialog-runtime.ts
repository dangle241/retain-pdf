import {
  APP_EVENTS,
  TRANSLATION_WORKFLOW_DIALOG,
  TRANSLATION_WORKFLOW_MODES,
} from "../../composition/external.js";
import type { TranslationWorkflowDialogStatePort } from "../../composition/external.js";

// Runtime hộp thoại workflow dịch (controller bản React).
//
// Tái sử dụng logic thuần: dialogStatePort trong state.js (store điều khiển đóng/mở/chế độ và đồng bộ
// viewMode của home), hằng số chế độ trong contract.js và hợp đồng status-area-port. Phần gắn DOM của controller.js cũ
// (dialogElement/closeButton addEventListener) được thay bằng
// onClick của component React; tại đây chỉ giữ cầu nối sự kiện cấp document.
//
// Hợp đồng sự kiện (rủi ro thiết kế 5, không được phá):
// - Mọi điểm vào đóng/mở phía người dùng (nút Thêm / nút đóng / nền sau / Escape) trước tiên đều dispatch
//   APP_EVENTS.openTranslationWorkflow / closeTranslationWorkflow, sau đó listener document của
//   runtime này thống nhất ghi trạng thái; việc tạm dừng/tiếp tục làm mới thư viện trong recent-jobs 3b
//   (bindings.js) và luồng gửi app-actions đều phụ thuộc việc hai sự kiện này hiển thị trên document.
// - translationWorkflowSync / statusAreaVisibilityChanged → đồng bộ chế độ.

export interface TranslationWorkflowStatusAreaPort {
  isVisible?: () => boolean;
  hide?: () => void;
  returnHome?: () => void;
}

export interface TranslationWorkflowUploadSessionPort {
  resetUploadSession?: () => void;
}

export interface CreateTranslationWorkflowDialogRuntimeOptions {
  dialogStatePort?: TranslationWorkflowDialogStatePort;
  statusAreaPort?: TranslationWorkflowStatusAreaPort;
  uploadSessionPort?: TranslationWorkflowUploadSessionPort | null;
  documentRef?: Document;
}

export interface OpenTranslationWorkflowEventDetail {
  mode?: string;
}

export type OpenTranslationWorkflowEventLike = Event | {
  detail?: OpenTranslationWorkflowEventDetail;
};

export function createTranslationWorkflowDialogRuntime({
  dialogStatePort,
  statusAreaPort,
  uploadSessionPort = null,
  documentRef = globalThis.document,
}: CreateTranslationWorkflowDialogRuntimeOptions = {}) {
  // Bản sửa 3b (phát hiện khi kiểm tra thực tế, không được thiết kế trước): refresh-environment.js của recent-jobs
  // mặc định để isWorkflowOpen đọc thuộc tính data-open của #translation-workflow-dialog
  // trong DOM, không đọc store nào; còn việc React commit DOM là bất đồng bộ so với ghi store.
  // Chuỗi do close() kích hoạt: "ghi store → listener closeTranslationWorkflow trong bindings.js
  // đọc DOM để xác định isSuspended()" diễn ra trong cùng call stack phân phát sự kiện đồng bộ; lúc này React
  // chưa kịp render lại và commit data-open mới, DOM vẫn đọc giá trị cũ trước khi đóng; kiểm tra thực tế tái hiện thành
  // "sau khi đóng hộp thoại workflow, làm mới thư viện bị kẹt vĩnh viễn" (biểu hiện cụ thể của rủi ro thiết kế 5).
  // mountRecentJobsFeature không mở điểm inject environment (xem
  // giải thích trong composition.js), không thể inject isWorkflowOpen đọc store từ thượng nguồn; chỉ có thể làm ngược lại: cùng nhịp ghi store,
  // ghi đồng bộ thêm thuộc tính này vào DOM để loại bỏ cửa sổ race condition cho phía đọc DOM.
  // Sau đó React vẫn render lại cùng giá trị theo nhịp riêng (idempotent, không có tác dụng phụ).
  function syncOpenAttributeToDom(open: boolean) {
    const dialogEl = documentRef?.getElementById?.(TRANSLATION_WORKFLOW_DIALOG.ids.dialog);
    if (dialogEl?.dataset) {
      dialogEl.dataset.open = open
        ? TRANSLATION_WORKFLOW_DIALOG.datasetValues.open
        : TRANSLATION_WORKFLOW_DIALOG.datasetValues.closed;
    }
  }
  function resolveMode(mode?: string) {
    if (mode === TRANSLATION_WORKFLOW_MODES.STATUS || mode === TRANSLATION_WORKFLOW_MODES.UPLOAD) {
      return mode;
    }
    return statusAreaPort?.isVisible?.()
      ? TRANSLATION_WORKFLOW_MODES.STATUS
      : TRANSLATION_WORKFLOW_MODES.UPLOAD;
  }

  function isOpen() {
    return Boolean(dialogStatePort.getSnapshot().open);
  }

  // ---- Ghi trạng thái (listener document gọi; phản chiếu openUpload/openFromEvent/close/sync của controller cũ) ----

  function openUpload() {
    statusAreaPort?.hide?.();
    uploadSessionPort?.resetUploadSession?.();
    dialogStatePort.open(TRANSLATION_WORKFLOW_MODES.UPLOAD);
    syncOpenAttributeToDom(true);
  }

  function openFromEvent(event: OpenTranslationWorkflowEventLike = {} as OpenTranslationWorkflowEventLike) {
    const detail = (event as { detail?: OpenTranslationWorkflowEventDetail })?.detail;
    const mode = detail?.mode;
    if (!mode || mode === TRANSLATION_WORKFLOW_MODES.UPLOAD) {
      openUpload();
      return;
    }
    dialogStatePort.open(resolveMode(mode));
    syncOpenAttributeToDom(true);
  }

  function close() {
    dialogStatePort.close();
    syncOpenAttributeToDom(false);
  }

  function sync() {
    dialogStatePort.setMode(resolveMode());
  }

  // ---- Điểm vào phía người dùng (component React gọi; chỉ phát sự kiện, không sửa trạng thái trực tiếp) ----

  function dispatch(eventName: string, detail?: unknown) {
    if (documentRef?.dispatchEvent && typeof globalThis.CustomEvent === "function") {
      documentRef.dispatchEvent(new globalThis.CustomEvent(eventName, { detail }));
    }
  }

  function requestOpenUpload() {
    dispatch(APP_EVENTS.openTranslationWorkflow, { mode: TRANSLATION_WORKFLOW_MODES.UPLOAD });
  }

  // Đóng = đóng hộp thoại trực tiếp bằng một lần bấm (bất kể đang ở trạng thái tải lên hay tiến độ tác vụ).
  //
  // Cách "đóng hai bước" cũ (khi trạng thái hiển thị thì returnHome trước nhưng không đóng hộp thoại, phải bấm lần nữa mới đóng) được
  // người dùng đánh giá là trái kỳ vọng: bấm × ở tiến độ tác vụ sẽ quay về biểu mẫu tải lên "Dịch PDF" trống và còn âm thầm
  // stopPolling để đặt lại tác vụ, giống như "bấm đóng nhưng lại lùi một bước". Nay thống nhất thành "× =
  // đóng". Muốn dừng tác vụ đang chạy thì dùng nút "Hủy tác vụ" chuyên dụng trên StatusCard
  // (cancelCurrentJob), không dùng việc đóng hộp thoại để kiêm nhiệm.
  //
  // Đóng không ảnh hưởng tác vụ nền: polling job-runtime độc lập với vòng đời mount của hộp thoại; khi tác vụ tới trạng thái cuối,
  // controller.js tự gọi pollingPort.stop() (xem §renderJob trong file đó); việc đóng hộp thoại không làm
  // mất một polling thường trực; thẻ trong lưới thư viện vẫn hiển thị tiến độ thời gian thực của tác vụ.
  function requestClose() {
    dispatch(APP_EVENTS.closeTranslationWorkflow);
  }

  function bindEvents() {
    if (!documentRef?.addEventListener) {
      return () => {};
    }
    const bindings: Array<[string, EventListener]> = [
      [APP_EVENTS.openTranslationWorkflow, openFromEvent as unknown as EventListener],
      [APP_EVENTS.closeTranslationWorkflow, close as EventListener],
      [APP_EVENTS.translationWorkflowSync, sync as EventListener],
      [APP_EVENTS.statusAreaVisibilityChanged, sync as EventListener],
    ];
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen()) {
        requestClose();
      }
    };
    bindings.forEach(([name, handler]) => documentRef.addEventListener(name, handler));
    documentRef.addEventListener("keydown", onKeydown);
    return () => {
      bindings.forEach(([name, handler]) => documentRef.removeEventListener(name, handler));
      documentRef.removeEventListener("keydown", onKeydown);
    };
  }

  return {
    bindEvents,
    close,
    isOpen,
    openFromEvent,
    openUpload,
    requestClose,
    requestOpenUpload,
    statePort: dialogStatePort,
    sync,
  };
}
